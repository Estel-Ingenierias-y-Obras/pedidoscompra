codeunit 60709 "GM Post Management"
{
    Access = Internal;
    Permissions = tabledata "GM Entry Request" = RM,
                  tabledata "Item Journal Line" = RD;

    // Deliberately posts exactly one simple inventory line. No batch posting.
    // Advanced warehouse and tracking scenarios need their own complete workflow.
    [CommitBehavior(CommitBehavior::Error)]
    procedure PostEntry(IntegrationKey: Guid; LineId: Guid; var Result: Record "GM Entry Request")
    var
        Request: Record "GM Entry Request";
        Batch: Record "Item Journal Batch";
        Template: Record "Item Journal Template";
        Line: Record "Item Journal Line";
        OriginalLine: Record "Item Journal Line";
        Location: Record Location;
        Item: Record Item;
        DimMgt: Codeunit DimensionManagement;
        EntryMgt: Codeunit "GM Entry Management";
        PostLine: Codeunit "Item Jnl.-Post Line";
        PostedEntry: Record "Item Ledger Entry";
    begin
        if IsNullGuid(IntegrationKey) or IsNullGuid(LineId) then
            Error('claveintegracion e idlinea son obligatorios.');
        Batch.LockTable();
        Batch.Get('ELEMENTO', 'GENERICO');
        Request.LockTable();
        if not Request.Get(IntegrationKey) then
            Error('GM_ENTRY_GONE: no existe la solicitud de entrada.');
        Request.TestField("Project Journal", false);
        if Request."Journal Line Id" <> LineId then
            Error('GM_KEY_CONFLICT: la clave no corresponde a esta linea.');
        if Request.Posted then begin
            Request.TestField("Posted At");
            Request.TestField("Document No.");
            Result := Request;
            exit;
        end;
        Line.LockTable();
        if not Line.GetBySystemId(LineId) then
            Error('GM_ENTRY_GONE: la linea ya no existe; no se recreara ni se asumira que esta registrada.');
        if Line."GM Integration Key" <> IntegrationKey then
            Error('GM_KEY_CONFLICT: la clave no corresponde a esta linea.');
        Line.TestField("Journal Template Name", 'ELEMENTO');
        Line.TestField("Journal Batch Name", 'GENERICO');
        if Line."Document No." <> Request."Document No." then
            Error('GM_DOCUMENT_CONFLICT: la solicitud guarda %1 pero la linea %2 conserva %3. No se renumerara ni se recreara.', Request."Document No.", Line.SystemId, Line."Document No.");
        Line.TestField("Document No.");
        Template.Get('ELEMENTO');
        Template.TestField(Recurring, false);
        Template.TestField(Type, Template.Type::Item);
        Line.TestField("Entry Type", Line."Entry Type"::"Positive Adjmt.");
        Line.TestField("Location Code", 'CENTRAL 3');
        Line.TestField("Variant Code", '');
        Line.TestField("Shortcut Dimension 2 Code", 'SG-ALMACEN');
        if not (Line."Shortcut Dimension 1 Code" in ['DIRECTO', 'INDIRECTO', 'GRUPO']) then
            Error('Tipo de proyecto no permitido.');
        if (Line.Quantity <= 0) or (Line."Quantity (Base)" <= 0) then
            Error('La cantidad debe ser positiva.');
        Item.Get(Line."Item No.");
        Item.TestField(Blocked, false);
        Item.TestField(Type, Item.Type::Inventory);
        Item.TestField("Item Tracking Code", '');
        Location.Get('CENTRAL 3');
        Location.TestField("Use As In-Transit", false);
        Location.TestField("Bin Mandatory", false);
        Location.TestField("Directed Put-away and Pick", false);
        Location.TestField("Require Receive", false);
        Location.TestField("Require Put-away", false);
        Location.TestField("Require Pick", false);
        Location.TestField("Require Shipment", false);
        Line.TestField("Bin Code", '');
        CheckSimpleLine(Line);
        EntryMgt.ApplyFixedDimensions(Line);
        CheckDimensionsAndUnits(Line);
        CheckApplication(Line);
        if not DimMgt.CheckDimIDComb(Line."Dimension Set ID") then
            Error(DimMgt.GetDimCombErr());
        Batch.TestField("No. Series", 'DIAP-GEN');
        if not (Batch."Posting No. Series" in ['', 'DIAP-GEN']) then
            Error('GM_SERIES_CONFIG: la API no admite una serie de registro distinta de DIAP-GEN (%1).', Batch."Posting No. Series");
        if not (Line."Posting No. Series" in ['', 'DIAP-GEN']) then
            Error('GM_SERIES_CONFIG: la linea tiene una serie de registro distinta (%1); requiere revision.', Line."Posting No. Series");
        // Legacy pending lines retain their document, key and SystemId. Only
        // normalize series metadata on the posting buffer, not persisted lines.
        Line.SetDocNos(Line."Document Type", Line."Document No.", Line."External Document No.", 'DIAP-GEN');
        OriginalLine := Line;
        // Start a write transaction before calling subscribers/standard posting.
        // Boolean Codeunit.Run would fail here instead of implicitly committing.
        // RunWithCheck below is an ordinary procedure, NOT Boolean Codeunit.Run.
        Request.Modify(true);
        // Creation allocates a unique document number. Refuse to infer success
        // from a movement that existed before this invocation.
        PostedEntry.SetRange("Document No.", OriginalLine."Document No.");
        if not PostedEntry.IsEmpty() then
            Error('GM_POST_AMBIGUOUS: ya existen movimientos para este documento sin recibo confirmado. Revise en BC.');
        if not PostLine.RunWithCheck(Line) then
            Error('GM_POST_NOT_CONFIRMED: BC no ha confirmado el registro de la linea.');
        if PostedEntry.Count() <> 1 then
            Error('GM_POST_NOT_CONFIRMED: se esperaba exactamente un movimiento nuevo para el documento.');
        PostedEntry.FindFirst();
        PostedEntry.TestField("Item No.", OriginalLine."Item No.");
        PostedEntry.TestField("Entry Type", PostedEntry."Entry Type"::"Positive Adjmt.");
        PostedEntry.TestField("Posting Date", OriginalLine."Posting Date");
        PostedEntry.TestField("Location Code", OriginalLine."Location Code");
        PostedEntry.TestField(Quantity, OriginalLine."Quantity (Base)");
        PostedEntry.TestField("Dimension Set ID", OriginalLine."Dimension Set ID");
        Line.TestField("Document No.", OriginalLine."Document No.");
        OriginalLine.Delete(true);
        Request.Posted := true;
        Request."Posted At" := CurrentDateTime();
        Request."Item Ledger Entry No." := PostedEntry."Entry No.";
        Request.Modify(true);
        Result := Request;
        // Receipt and ledger changes share the same transaction. No COMMIT.
    end;

    [EventSubscriber(ObjectType::Codeunit, Codeunit::"Item Jnl.-Post Batch", 'OnBeforeCheckJnlLine', '', false, false)]
    local procedure RejectBatchNumbering(var ItemJournalLine: Record "Item Journal Line"; SuppressCommit: Boolean; var IsHandled: Boolean)
    begin
        if ItemJournalLine.IsTemporary() or IsNullGuid(ItemJournalLine."GM Integration Key") then
            exit;
        if (ItemJournalLine."Journal Template Name" <> 'ELEMENTO') or
           (ItemJournalLine."Journal Batch Name" <> 'GENERICO') then
            exit;
        // Batch posting asks DIAP-GEN for the NEXT number, but these API
        // documents were allocated at creation. Do not skip standard checks,
        // renumber documents, consume the series twice or lose the API receipt.
        Error('GM_USE_POST_API: el documento %1 fue numerado al crearlo. Registre esta linea con POST /registrosProducto y su clave e idlinea; no mediante registro de seccion.', ItemJournalLine."Document No.");
    end;

    local procedure CheckSimpleLine(Line: Record "Item Journal Line")
    var
        Reservation: Record "Reservation Entry";
    begin
        // Reject modes that bypass normal quantity/dimension checks or need a
        // document, physical inventory, tracking or warehouse posting workflow.
        Line.TestField("Value Entry Type", Line."Value Entry Type"::"Direct Cost");
        Line.TestField("Item Charge No.", '');
        Line.TestField(Adjustment, false);
        Line.TestField(Correction, false);
        Line.TestField("Phys. Inventory", false);
        Line.TestField("Drop Shipment", false);
        Line.TestField("Job No.", '');
        Line.TestField("Order No.", '');
        Line.TestField("Document Type", Line."Document Type"::" ");
        Line.TestField("Applies-from Entry", 0);
        Line.TestField("Serial No.", '');
        Line.TestField("Lot No.", '');
        Line.TestField("Package No.", '');
        Line.TestField("New Location Code", '');
        Line.TestField("New Bin Code", '');
        Line.TestField("Discount Amount", 0);
        Reservation.SetRange("Source Type", Database::"Item Journal Line");
        Reservation.SetRange("Source Subtype", Line."Entry Type".AsInteger());
        Reservation.SetRange("Source ID", Line."Journal Template Name");
        Reservation.SetRange("Source Batch Name", Line."Journal Batch Name");
        Reservation.SetRange("Source Ref. No.", Line."Line No.");
        if not Reservation.IsEmpty() then
            Error('GM_UNSUPPORTED: la linea tiene reservas o seguimiento; use el circuito estandar de BC.');
    end;

    local procedure CheckDimensionsAndUnits(Line: Record "Item Journal Line")
    var
        Setup: Record "General Ledger Setup";
        DimEntry: Record "Dimension Set Entry";
        Dimension: Record Dimension;
        DimValue: Record "Dimension Value";
        ItemUnit: Record "Item Unit of Measure";
        Unit: Record "Unit of Measure";
        UOM: Codeunit "Unit of Measure Management";
    begin
        Setup.Get();
        Setup.TestField("Global Dimension 1 Code", 'TIPO PROYECTO');
        Setup.TestField("Global Dimension 2 Code", 'DEPART');
        Setup.TestField("Shortcut Dimension 1 Code", 'TIPO PROYECTO');
        Setup.TestField("Shortcut Dimension 2 Code", 'DEPART');
        DimEntry.Get(Line."Dimension Set ID", 'DEPART');
        DimEntry.TestField("Dimension Value Code", 'SG-ALMACEN');
        DimEntry.Get(Line."Dimension Set ID", 'TIPO PROYECTO');
        DimEntry.TestField("Dimension Value Code", Line."Shortcut Dimension 1 Code");
        DimEntry.SetRange("Dimension Set ID", Line."Dimension Set ID");
        if DimEntry.FindSet() then
            repeat
                Dimension.Get(DimEntry."Dimension Code");
                Dimension.TestField(Blocked, false);
                DimValue.Get(DimEntry."Dimension Code", DimEntry."Dimension Value Code");
                DimValue.TestField(Blocked, false);
                DimValue.TestField("Dimension Value Type", DimValue."Dimension Value Type"::Standard);
            until DimEntry.Next() = 0;
        Line.TestField("Unit of Measure Code");
        Unit.Get(Line."Unit of Measure Code");
        ItemUnit.Get(Line."Item No.", Line."Unit of Measure Code");
        if ItemUnit."Qty. per Unit of Measure" <= 0 then
            Error('El factor de unidad debe ser positivo.');
        Line.TestField("Qty. per Unit of Measure", ItemUnit."Qty. per Unit of Measure");
        Line.TestField("Quantity (Base)", UOM.CalcBaseQty(
            Line."Item No.", Line."Variant Code", Line."Unit of Measure Code",
            Line.Quantity, Line."Qty. per Unit of Measure", Line."Qty. Rounding Precision (Base)"));
        // RunWithCheck performs the standard posting checks, including default
        // dimensions of item/location, posting groups and allowed posting dates.
    end;

    local procedure CheckApplication(Line: Record "Item Journal Line")
    var
        Entry: Record "Item Ledger Entry";
    begin
        if Line."Applies-to Entry" = 0 then
            exit;
        Entry.LockTable();
        Entry.Get(Line."Applies-to Entry");
        Entry.TestField("Item No.", Line."Item No.");
        Entry.TestField("Location Code", Line."Location Code");
        Entry.TestField("Variant Code", '');
        Entry.TestField(Open, true);
        Entry.TestField(Positive, false);
        if Entry.TrackingExists() then
            Error('GM_UNSUPPORTED: el movimiento aplicado tiene seguimiento.');
        if (Entry."Remaining Quantity" >= 0) or
           (Line."Quantity (Base)" > -Entry."Remaining Quantity") then
            Error('La cantidad base supera la cantidad pendiente de la salida.');
    end;
}
