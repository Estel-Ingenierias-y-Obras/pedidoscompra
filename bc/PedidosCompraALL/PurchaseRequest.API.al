page 59112 "EST Purchase Request API"
{
    PageType = API;
    APIPublisher = 'estel';
    APIGroup = 'purchase';
    APIVersion = 'v1.0';
    EntityName = 'purchaseRequest';
    EntitySetName = 'purchaseRequests';
    SourceTable = "EST Purchase Request";
    ODataKeyFields = Id;
    DelayedInsert = true;
    ModifyAllowed = false;
    DeleteAllowed = false;
    layout
    {
        area(content)
        {
            repeater(General)
            {
                field(id; Rec.Id) { }
                field(fingerprint; Rec.Fingerprint) { }
                field(payload; PayloadText) { }
                field(headerId; Rec."Header Id") { Editable = false; }
                field(number; Rec."Order No.") { Editable = false; }
                field(status; StatusText) { Editable = false; }
            }
        }
    }
    var
        PayloadText: Text;
        StatusText: Text;

    trigger OnInsertRecord(BelowxRec: Boolean): Boolean
    begin
        exit(CreateOrder());
    end;

    [CommitBehavior(CommitBehavior::Error)]
    local procedure CreateOrder(): Boolean
    var
        Header: Record "Purchase Header";
        Line: Record "Purchase Line";
        Body: JsonObject;
        Lines: JsonArray;
        Entry: JsonToken;
        Token: JsonToken;
        Item: JsonObject;
        LineNo: Integer;
        DateValue: Date;
    begin
        if IsNullGuid(Rec.Id) or (StrLen(Rec.Fingerprint) <> 64) then
            Error('Identificador de solicitud no valido.');
        if not Body.ReadFrom(PayloadText) then
            Error('Pedido JSON no valido.');
        Body.Get('lineas', Token);
        Lines := Token.AsArray();
        if (Lines.Count() < 1) or (Lines.Count() > 100) then
            Error('El pedido debe tener entre 1 y 100 lineas.');
        Header.Init();
        Header."Document Type" := Header."Document Type"::Order;
        Header.Insert(true);
        Body.Get('proveedor', Token);
        Header.Validate("Buy-from Vendor No.", Token.AsValue().AsText());
        Header.Validate("Posting Date", WorkDate());
        Header.Validate("Document Date", WorkDate());
        Header.Validate("Order Date", WorkDate());
        Header.Validate("VAT Reporting Date", Header."Posting Date");
        Body.Get('fechaRecepcion', Token);
        Evaluate(DateValue, Token.AsValue().AsText(), 9);
        Header.Validate("Expected Receipt Date", DateValue);
        Body.Get('proyecto', Token);
        Header.Validate(ALXProyecto, Token.AsValue().AsText());
        Header.TestField(ALXProyecto);
        Body.Get('tarea', Token);
        Header.Validate(ALXTarea, Token.AsValue().AsText());
        Header.TestField(ALXTarea);
        Body.Get('usuarioAsignado', Token);
        Header.Validate("Assigned User ID", Token.AsValue().AsText());
        Header.TestField("Assigned User ID");
        SetDeliveryAddress(Header, Body);
        Header.Modify(true);
        foreach Entry in Lines do begin
            Item := Entry.AsObject();
            LineNo += 10000;
            Line.Init();
            Line."Document Type" := Header."Document Type";
            Line."Document No." := Header."No.";
            Line."Line No." := LineNo;
            Line.Insert(true);
            Line.Validate(Type, Line.Type::Item);
            Item.Get('articulo', Token);
            Line.Validate("No.", Token.AsValue().AsText());
            if Item.Get('almacen', Token) then
                if Token.AsValue().AsText() <> '' then
                    Line.Validate("Location Code", Token.AsValue().AsText());
            if Item.Get('unidad', Token) then
                if Token.AsValue().AsText() <> '' then
                    Line.Validate("Unit of Measure Code", Token.AsValue().AsText());
            if Header.ALXProyecto <> '' then
                Line.Validate("Job No.", Header.ALXProyecto);
            Line.Validate("Job Task No.", Header.ALXTarea);
            Item.Get('cantidad', Token);
            if Token.AsValue().AsDecimal() <= 0 then
                Error('La cantidad debe ser positiva.');
            Line.Validate(Quantity, Token.AsValue().AsDecimal());
            if Item.Get('coste', Token) then
                Line.Validate("Direct Unit Cost", Token.AsValue().AsDecimal());
            Line.Modify(true);
        end;
        Header.Get(Header."Document Type", Header."No.");
        Header.TestField(Status, Header.Status::Open);
        Rec."Header Id" := Header.SystemId;
        Rec."Order No." := Header."No.";
        StatusText := 'Open';
        PayloadText := '';
        exit(true);
    end;

    local procedure SetDeliveryAddress(var Header: Record "Purchase Header"; Body: JsonObject)
    var
        Token: JsonToken;
        Address: JsonObject;
    begin
        Body.Get('entrega', Token);
        Address := Token.AsObject();
        Address.Get('pais', Token);
        Header.Validate("Ship-to Country/Region Code", Token.AsValue().AsText());
        Address.Get('nombre', Token);
        Header.Validate("Ship-to Name", Token.AsValue().AsText());
        Address.Get('direccion', Token);
        Header.Validate("Ship-to Address", Token.AsValue().AsText());
        Address.Get('direccion2', Token);
        Header.Validate("Ship-to Address 2", Token.AsValue().AsText());
        Address.Get('codigoPostal', Token);
        Header.Validate("Ship-to Post Code", Token.AsValue().AsText());
        Address.Get('ciudad', Token);
        Header.Validate("Ship-to City", Token.AsValue().AsText());
        Address.Get('provincia', Token);
        Header.Validate("Ship-to County", Token.AsValue().AsText());
        Address.Get('contacto', Token);
        Header.Validate("Ship-to Contact", Token.AsValue().AsText());
    end;

    trigger OnAfterGetRecord()
    var
        Header: Record "Purchase Header";
    begin
        StatusText := 'Missing';
        if Header.GetBySystemId(Rec."Header Id") then
            case Header.Status of
                Header.Status::Open: StatusText := 'Open';
                Header.Status::Released: StatusText := 'Released';
                Header.Status::"Pending Approval": StatusText := 'Pending Approval';
                Header.Status::"Pending Prepayment": StatusText := 'Pending Prepayment';
            end;
    end;

    [ServiceEnabled]
    procedure lanzar(var ActionContext: WebServiceActionContext)
    var
        Header: Record "Purchase Header";
        ReleaseDocument: Codeunit "Release Purchase Document";
    begin
        if not Header.GetBySystemId(Rec."Header Id") then
            Error('El pedido original no existe; no se creara otro.');
        Header.TestField("Document Type", Header."Document Type"::Order);
        if Header.Status <> Header.Status::Released then begin
            Header.TestField(Status, Header.Status::Open);
            ReleaseDocument.PerformManualRelease(Header);
        end;
        Header.GetBySystemId(Rec."Header Id");
        Header.TestField(Status, Header.Status::Released);
        ActionContext.SetObjectType(ObjectType::Page);
        ActionContext.SetObjectId(Page::"EST Purchase Request API");
        ActionContext.AddEntityKey(Rec.FieldNo(Id), Rec.Id);
        ActionContext.SetResultCode(WebServiceActionResultCode::Updated);
    end;
}
