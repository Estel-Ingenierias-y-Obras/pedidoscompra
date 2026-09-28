codeunit 60703 "GM Entry Management"
{
    Access = Internal;
    Permissions = tabledata "Item Journal Line" = RI,
                  tabledata "GM Entry Request" = RI,
                  tabledata "Dimension Set Entry" = RI,
                  tabledata "Dimension Set Tree Node" = RIM,
                  tabledata "Planning Assignment" = RIMD;

    procedure ScopeLines(var Line: Record "Item Journal Line")
    var
        EmptyGuid: Guid;
    begin
        Line.FilterGroup(2);
        Line.SetRange("Journal Template Name", 'ELEMENTO');
        Line.SetRange("Journal Batch Name", 'GENERICO');
        Line.SetFilter("GM Integration Key", '<>%1', EmptyGuid);
        Line.FilterGroup(0);
    end;

    [CommitBehavior(CommitBehavior::Error)]
    procedure CreateEntry(Input: Record "Item Journal Line" temporary; IntegrationKey: Guid; PriceMode: Integer; var ResultLine: Record "Item Journal Line")
    var
        Request: Record "GM Entry Request";
        Batch: Record "Item Journal Batch";
        Template: Record "Item Journal Template";
        Line: Record "Item Journal Line";
        LastLine: Record "Item Journal Line";
        Item: Record Item;
        Location: Record Location;
        GLSetup: Record "General Ledger Setup";
        Payload: Text;
        NextLineNo: Integer;
    begin
        if IsNullGuid(IntegrationKey) then
            Error('claveintegracion es obligatoria y debe ser un UUID distinto de cero.');
        Payload := BuildPayload(Input, PriceMode);

        // Lock an existing row BEFORE checking the key. This also serializes
        // requests when there are no journal lines or previous requests yet.
        Batch.LockTable();
        Batch.Get('ELEMENTO', 'GENERICO');
        if Request.Get(IntegrationKey) then begin
            if Request.Payload <> Payload then
                Error('GM_KEY_CONFLICT: la claveintegracion ya existe con otros datos.');
            if not Line.GetBySystemId(Request."Journal Line Id") then
                Error('GM_ENTRY_GONE: la entrada %1 ya se creo, pero su linea ya no existe. No se creara otra.', Request."Document No.");
            Line.TestField("Journal Template Name", 'ELEMENTO');
            Line.TestField("Journal Batch Name", 'GENERICO');
            Line.TestField("GM Integration Key", IntegrationKey);
            ResultLine := Line;
            exit;
        end;

        Batch.TestField("No. Series", 'DIAP-GEN');
        Template.Get(Batch."Journal Template Name");
        Template.TestField(Recurring, false);
        Template.TestField(Type, Template.Type::Item);
        GLSetup.Get();
        GLSetup.TestField("Global Dimension 1 Code", 'TIPO PROYECTO');
        GLSetup.TestField("Global Dimension 2 Code", 'DEPART');
        GLSetup.TestField("Shortcut Dimension 1 Code", 'TIPO PROYECTO');
        GLSetup.TestField("Shortcut Dimension 2 Code", 'DEPART');
        Location.Get('CENTRAL 3');
        Location.TestField("Use As In-Transit", false);
        CheckItem(Input."Item No.");
        Item.Get(Input."Item No.");
        if Input.Quantity <= 0 then
            Error('cantidad debe ser mayor que cero.');

        LastLine.LockTable();
        LastLine.SetRange("Journal Template Name", Batch."Journal Template Name");
        LastLine.SetRange("Journal Batch Name", Batch.Name);
        NextLineNo := 10000;
        if LastLine.FindLast() then
            NextLineNo := LastLine."Line No." + 10000;

        Line.Init();
        Line."Journal Template Name" := Batch."Journal Template Name";
        Line."Journal Batch Name" := Batch.Name;
        Line."Line No." := NextLineNo;
        Line."Source Code" := Template."Source Code";
        Line."Reason Code" := Batch."Reason Code";
        Line."Posting No. Series" := Batch."Posting No. Series";
        Line."GM Integration Key" := IntegrationKey;
        Line.Validate("Posting Date", Today());
        Line.Validate("Entry Type", Line."Entry Type"::"Positive Adjmt.");
        Line.Validate("Item No.", Input."Item No.");
        Line.Validate("Location Code", Location.Code);
        if Input."Unit of Measure Code" <> '' then
            Line.Validate("Unit of Measure Code", Input."Unit of Measure Code");
        Line.TestField("Unit of Measure Code");
        Line.Validate(Quantity, Input.Quantity);
        Line.TestField("Quantity (Base)");
        ValidateApplication(Line, Input."Applies-to Entry");
        ValidateDimensions(Line, Input."Shortcut Dimension 1 Code");
        ValidatePrice(Line, Input, PriceMode, Item, GLSetup);

        // Real series allocation, after deduplication and business validation.
        Line.Validate("Document No.", AllocateDocumentNo(Batch."No. Series", Line."Posting Date"));
        AssertFixedFields(Line, Item);
        Line.Insert(true);
        AssertFixedFields(Line, Item);
        Request.Init();
        Request."Integration Key" := IntegrationKey;
        Request.Payload := CopyStr(Payload, 1, MaxStrLen(Request.Payload));
        Request."Journal Line Id" := Line.SystemId;
        Request."Document No." := Line."Document No.";
        Request.Insert(true);
        ResultLine := Line;
        // No COMMIT, no posting: the line, series and receipt share a transaction.
    end;

    procedure CheckItem(ItemNo: Code[20])
    var
        Item: Record Item;
    begin
        Item.Get(ItemNo);
        Item.TestField(Blocked, false);
        Item.TestField(Type, Item.Type::Inventory);
    end;

    local procedure ValidateApplication(var Line: Record "Item Journal Line"; EntryNo: Integer)
    var
        Entry: Record "Item Ledger Entry";
    begin
        if EntryNo <> 0 then begin
            Entry.Get(EntryNo);
            Entry.TestField("Item No.", Line."Item No.");
            Entry.TestField("Location Code", 'CENTRAL 3');
            Entry.TestField("Variant Code", '');
            Entry.TestField(Open, true);
            Entry.TestField(Positive, false);
            Entry.TestField("Package No.", '');
            if Entry.TrackingExists() then
                Error('El movimiento requiere seguimiento de producto; no es elegible en esta API.');
            if (Entry."Remaining Quantity" >= 0) or
               (Line."Quantity (Base)" > -Entry."Remaining Quantity") then
                Error('La cantidad base supera la cantidad pendiente del movimiento de salida.');
        end;
        Line.Validate("Applies-to Entry", EntryNo);
    end;

    local procedure ValidateDimensions(var Line: Record "Item Journal Line"; ProjectType: Code[20])
    var
        DimMgt: Codeunit DimensionManagement;
        TableIds: array[10] of Integer;
        Numbers: array[10] of Code[20];
    begin
        if not (ProjectType in ['DIRECTO', 'INDIRECTO', 'GRUPO']) then
            Error('tipoproyectocodigo debe ser DIRECTO, INDIRECTO o GRUPO.');
        CheckDimension('TIPO PROYECTO', ProjectType);
        CheckDimension('DEPART', 'SG-ALMACEN');
        Line.Validate("Shortcut Dimension 1 Code", ProjectType);
        Line.Validate("Shortcut Dimension 2 Code", 'SG-ALMACEN');
        if not DimMgt.CheckDimIDComb(Line."Dimension Set ID") then
            Error(DimMgt.GetDimCombErr());
        TableIds[1] := Database::Item;
        Numbers[1] := Line."Item No.";
        TableIds[2] := Database::Location;
        Numbers[2] := Line."Location Code";
        if not DimMgt.CheckDimValuePosting(TableIds, Numbers, Line."Dimension Set ID") then
            Error(DimMgt.GetDimValuePostingErr());
    end;

    local procedure CheckDimension(DimensionCode: Code[20]; ValueCode: Code[20])
    var
        Dimension: Record Dimension;
        Value: Record "Dimension Value";
    begin
        Dimension.Get(DimensionCode);
        Dimension.TestField(Blocked, false);
        Value.Get(DimensionCode, ValueCode);
        Value.TestField(Blocked, false);
        Value.TestField("Dimension Value Type", Value."Dimension Value Type"::Standard);
    end;

    local procedure ValidatePrice(var Line: Record "Item Journal Line"; Input: Record "Item Journal Line" temporary; PriceMode: Integer; Item: Record Item; GLSetup: Record "General Ledger Setup")
    var
        DirectAmount: Decimal;
    begin
        if (PriceMode <> 0) and (Item."Costing Method" = Item."Costing Method"::Standard) then
            Error('BC determina el precio y coste de los productos con coste estandar. Omita los tres campos monetarios.');
        case PriceMode of
            0:
                exit;
            1:
                begin
                    if Input."Unit Amount" < 0 then
                        Error('preciounitario no puede ser negativo.');
                    Line.Validate("Unit Amount", Input."Unit Amount");
                end;
            2:
                begin
                    if Input.Amount < 0 then
                        Error('importe no puede ser negativo.');
                    Line.Validate(Amount, Input.Amount);
                end;
            3:
                begin
                    if Input."Unit Cost" < 0 then
                        Error('costeunitario no puede ser negativo.');
                    // Table 83 guards its inverse formula with CurrFieldNo.
                    // Server-side Validate does not emulate a UI edit of Unit Cost.
                    // Use the same inverse formula, then standard validation.
                    if (1 + Line."Indirect Cost %" / 100) <= 0 then
                        Error('El porcentaje de coste indirecto no permite calcular el precio.');
                    DirectAmount := Round(
                        (Input."Unit Cost" - Line."Overhead Rate" * Line."Qty. per Unit of Measure") /
                        (1 + Line."Indirect Cost %" / 100), GLSetup."Unit-Amount Rounding Precision");
                    if DirectAmount < 0 then
                        Error('El coste indicado es inferior al coste adicional configurado en BC.');
                    Line.Validate("Unit Amount", DirectAmount);
                end;
            else
                Error('Modo de precio no valido.');
        end;
    end;

    local procedure AssertFixedFields(Line: Record "Item Journal Line"; Item: Record Item)
    var
        DimensionEntry: Record "Dimension Set Entry";
    begin
        Line.TestField("Journal Template Name", 'ELEMENTO');
        Line.TestField("Journal Batch Name", 'GENERICO');
        Line.TestField("Posting Date", Today());
        Line.TestField("Entry Type", Line."Entry Type"::"Positive Adjmt.");
        Line.TestField("Location Code", 'CENTRAL 3');
        Line.TestField("Variant Code", '');
        Line.TestField(Description, Item.Description);
        Line.TestField("Item No.", Item."No.");
        if not (Line."Shortcut Dimension 1 Code" in ['DIRECTO', 'INDIRECTO', 'GRUPO']) then
            Error('Tipo de proyecto no permitido.');
        Line.TestField("Shortcut Dimension 2 Code", 'SG-ALMACEN');
        DimensionEntry.Get(Line."Dimension Set ID", 'TIPO PROYECTO');
        DimensionEntry.TestField("Dimension Value Code", Line."Shortcut Dimension 1 Code");
        DimensionEntry.Get(Line."Dimension Set ID", 'DEPART');
        DimensionEntry.TestField("Dimension Value Code", 'SG-ALMACEN');
        Line.TestField("Discount Amount", 0);
        Line.TestField("Document No.");
        if (Line.Quantity <= 0) or (Line."Quantity (Base)" <= 0) then
            Error('La cantidad y su conversion a unidad base deben ser positivas.');
    end;

    local procedure AllocateDocumentNo(SeriesCode: Code[20]; PostingDate: Date): Code[20]
    var
        ExistingLine: Record "Item Journal Line";
        ExistingEntry: Record "Item Ledger Entry";
        SeriesLine: Record "No. Series Line";
        NoSeries: Codeunit "No. Series";
        DocumentNo: Code[20];
        Attempts: Integer;
    begin
        NoSeries.TestAutomatic(SeriesCode);
        NoSeries.GetNoSeriesLine(SeriesLine, SeriesCode, PostingDate, false);
        if NoSeries.MayProduceGaps(SeriesLine) then
            Error('DIAP-GEN debe usar numeracion sin huecos para revertir el numero si falla la transaccion.');
        // Manual draft lines can already contain a number obtained with PeekNextNo.
        // Skip such numbers, always allocating through the standard series.
        for Attempts := 1 to 100 do begin
            DocumentNo := NoSeries.GetNextNo(SeriesCode, PostingDate);
            ExistingLine.SetRange("Document No.", DocumentNo);
            ExistingEntry.SetRange("Document No.", DocumentNo);
            if ExistingLine.IsEmpty() and ExistingEntry.IsEmpty() then
                exit(DocumentNo);
        end;
        Error('Revise DIAP-GEN: los siguientes 100 numeros ya existen en diarios o movimientos.');
    end;

    local procedure BuildPayload(Input: Record "Item Journal Line" temporary; PriceMode: Integer) Payload: Text
    var
        RequestJson: JsonObject;
    begin
        RequestJson.Add('item', Input."Item No.");
        RequestJson.Add('quantity', Input.Quantity);
        RequestJson.Add('unit', Input."Unit of Measure Code");
        RequestJson.Add('project', Input."Shortcut Dimension 1 Code");
        RequestJson.Add('appliesTo', Input."Applies-to Entry");
        RequestJson.Add('priceMode', PriceMode);
        case PriceMode of
            1: RequestJson.Add('price', Input."Unit Amount");
            2: RequestJson.Add('price', Input.Amount);
            3: RequestJson.Add('price', Input."Unit Cost");
        end;
        RequestJson.WriteTo(Payload);
    end;
}
