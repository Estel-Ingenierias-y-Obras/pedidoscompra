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
        Line: Record "Item Journal Line";
        OriginalLine: Record "Item Journal Line";
        Location: Record Location;
        Item: Record Item;
        DimMgt: Codeunit DimensionManagement;
        PostLine: Codeunit "Item Jnl.-Post Line";
    begin
        if IsNullGuid(IntegrationKey) or IsNullGuid(LineId) then
            Error('claveintegracion e idlinea son obligatorios.');
        Batch.LockTable();
        Batch.Get('ELEMENTO', 'GENERICO');
        Request.LockTable();
        if not Request.Get(IntegrationKey) then
            Error('GM_ENTRY_GONE: no existe la solicitud de entrada.');
        if Request."Journal Line Id" <> LineId then
            Error('GM_KEY_CONFLICT: la clave no corresponde a esta linea.');
        if Request.Posted then begin
            Result := Request;
            exit;
        end;
        Line.LockTable();
        if not Line.GetBySystemId(LineId) then
            Error('GM_ENTRY_GONE: la linea ya no existe; no se recreara ni se asumira que esta registrada.');
        Line.TestField("GM Integration Key", IntegrationKey);
        Line.TestField("Journal Template Name", 'ELEMENTO');
        Line.TestField("Journal Batch Name", 'GENERICO');
        Line.TestField("Document No.", Request."Document No.");
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
        if not DimMgt.CheckDimIDComb(Line."Dimension Set ID") then
            Error(DimMgt.GetDimCombErr());
        OriginalLine := Line;
        if not PostLine.RunWithCheck(Line) then
            Error('BC no ha confirmado el registro de la linea.');
        OriginalLine.Delete(true);
        Request.Posted := true;
        Request."Posted At" := CurrentDateTime();
        Request.Modify(true);
        Result := Request;
        // Receipt and ledger changes share the same transaction. No COMMIT.
    end;
}
