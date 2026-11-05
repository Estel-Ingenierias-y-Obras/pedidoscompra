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
                field(createdAt; Rec.SystemCreatedAt) { Editable = false; }
                field(deleted; Rec.Deleted) { Editable = false; }
                field(deletedAt; Rec."Deleted At") { Editable = false; }
                field(headerStatus; Rec."Header Status") { Editable = false; }
                field(releasedAt; Rec."Released At") { Editable = false; }
                field(vendorNumber; VendorNumber) { Editable = false; }
                field(vendorName; VendorName) { Editable = false; }
                field(projectNumber; ProjectNumber) { Editable = false; }
            }
        }
    }
    var
        PayloadText: Text;
        StatusText: Text;
        VendorNumber: Code[20];
        VendorName: Text[100];
        ProjectNumber: Code[20];

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
        SetPaymentAddress(Header, Body);
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
            if Header."Location Code" <> '' then
                Line.Validate("Location Code", Header."Location Code");
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

    local procedure SetPaymentAddress(var Header: Record "Purchase Header"; Body: JsonObject)
    var
        Token: JsonToken;
        Payment: JsonObject;
        Address: JsonObject;
        Kind: Text;
        PayVendor: Code[20];
    begin
        if not Body.Get('pago', Token) then
            exit;
        Payment := Token.AsObject();
        Payment.Get('tipo', Token);
        Kind := Token.AsValue().AsText();
        case Kind of
            'proveedor', 'personalizada': PayVendor := Header."Buy-from Vendor No.";
            'otro': begin
                Payment.Get('proveedor', Token);
                PayVendor := CopyStr(Token.AsValue().AsText(), 1, MaxStrLen(PayVendor));
                if PayVendor = '' then Error('Selecciona el proveedor de pago.');
            end;
            else Error('Direccion de pago no valida.');
        end;
        Header.Validate("Pay-to Vendor No.", PayVendor);
        if Kind = 'proveedor' then exit;
        Payment.Get('codigoContacto', Token);
        Header.Validate("Pay-to Contact No.", Token.AsValue().AsText());
        Header.TestField("Pay-to Vendor No.", PayVendor);
        if Token.AsValue().AsText() = '' then begin
            Payment.Get('contacto', Token);
            Header.Validate("Pay-to Contact", Token.AsValue().AsText());
        end;
        if Kind = 'personalizada' then
            if Payment.Get('personalizada', Token) then begin
                Address := Token.AsObject();
                Address.Get('pais', Token);
                Header.Validate("Pay-to Country/Region Code", Token.AsValue().AsText());
                Address.Get('direccion', Token);
                Header.Validate("Pay-to Address", Token.AsValue().AsText());
                Address.Get('direccion2', Token);
                Header.Validate("Pay-to Address 2", Token.AsValue().AsText());
                Address.Get('codigoPostal', Token);
                Header.Validate("Pay-to Post Code", Token.AsValue().AsText());
                Address.Get('ciudad', Token);
                Header.Validate("Pay-to City", Token.AsValue().AsText());
                Address.Get('provincia', Token);
                Header.Validate("Pay-to County", Token.AsValue().AsText());
            end;
    end;

    local procedure SetDeliveryAddress(var Header: Record "Purchase Header"; Body: JsonObject)
    var
        Token: JsonToken;
        Address: JsonObject;
        Project: Record Job;
        Customer: Record Customer;
        Warehouse: Record Location;
        Kind: Text;
        CustomAddress: JsonObject;
    begin
        Body.Get('entrega', Token);
        Address := Token.AsObject();
        Address.Get('tipo', Token);
        Kind := Token.AsValue().AsText();
        if Header."Sell-to Customer No." <> '' then
            Header.Validate("Sell-to Customer No.", '');
        // This is a new order, before any lines exist. Validating an empty
        // Ship-to Code requires a customer, so only the customer branch does it.
        Header."Ship-to Code" := '';
        if Header."Location Code" <> '' then
            Header.Validate("Location Code", '');
        case Kind of
            'empresa': begin
                Project.Get(Header.ALXProyecto);
                Project.TestField("Ship-to Address");
                Header.SetShipToAddress(Project."Ship-to Name", Project."Ship-to Name 2", Project."Ship-to Address", Project."Ship-to Address 2", Project."Ship-to City", Project."Ship-to Post Code", Project."Ship-to County", Project."Ship-to Country/Region Code");
                Header."Ship-to Phone No." := Project."Sell-to Phone No.";
                Header."Ship-to Contact" := Project."Ship-to Contact";
            end;
            'cliente': begin
                Address.Get('cliente', Token);
                Customer.Get(Token.AsValue().AsText());
                Header.Validate("Sell-to Customer No.", Customer."No.");
                Header.SetShipToAddress(Customer.Name, Customer."Name 2", Customer.Address, Customer."Address 2", Customer.City, Customer."Post Code", Customer.County, Customer."Country/Region Code");
                Header."Ship-to Phone No." := Customer."Phone No.";
                Header."Ship-to Contact" := Customer.Contact;
                Address.Get('codigoDireccion', Token);
                Header.Validate("Ship-to Code", Token.AsValue().AsText());
            end;
            'almacen': begin
                Address.Get('almacen', Token);
                Warehouse.Get(Token.AsValue().AsText());
                Warehouse.TestField("Use As In-Transit", false);
                Header.Validate("Location Code", Warehouse.Code);
                Header.SetShipToAddress(Warehouse.Name, Warehouse."Name 2", Warehouse.Address, Warehouse."Address 2", Warehouse.City, Warehouse."Post Code", Warehouse.County, Warehouse."Country/Region Code");
                Header."Ship-to Phone No." := Warehouse."Phone No.";
                Header."Ship-to Contact" := Warehouse.Contact;
            end;
            'personalizada': begin
                Address.Get('personalizada', Token);
                CustomAddress := Token.AsObject();
                CustomAddress.Get('pais', Token);
                Header.Validate("Ship-to Country/Region Code", Token.AsValue().AsText());
                CustomAddress.Get('nombre', Token);
                Header.Validate("Ship-to Name", Token.AsValue().AsText());
                CustomAddress.Get('nombre2', Token);
                Header.Validate("Ship-to Name 2", Token.AsValue().AsText());
                CustomAddress.Get('direccion', Token);
                Header.Validate("Ship-to Address", Token.AsValue().AsText());
                CustomAddress.Get('direccion2', Token);
                Header.Validate("Ship-to Address 2", Token.AsValue().AsText());
                CustomAddress.Get('codigoPostal', Token);
                Header.Validate("Ship-to Post Code", Token.AsValue().AsText());
                CustomAddress.Get('ciudad', Token);
                Header.Validate("Ship-to City", Token.AsValue().AsText());
                CustomAddress.Get('provincia', Token);
                Header.Validate("Ship-to County", Token.AsValue().AsText());
                CustomAddress.Get('telefono', Token);
                Header.Validate("Ship-to Phone No.", Token.AsValue().AsText());
                CustomAddress.Get('contacto', Token);
                Header.Validate("Ship-to Contact", Token.AsValue().AsText());
            end;
            else Error('Direccion de envio no valida.');
        end;
    end;

    trigger OnAfterGetRecord()
    var
        Header: Record "Purchase Header";
    begin
        StatusText := 'Missing';
        Clear(VendorNumber);
        Clear(VendorName);
        Clear(ProjectNumber);
        if Rec.Deleted then begin
            StatusText := 'Deleted';
            exit;
        end;
        if Header.GetBySystemId(Rec."Header Id") then begin
            VendorNumber := Header."Buy-from Vendor No.";
            VendorName := Header."Buy-from Vendor Name";
            ProjectNumber := Header.ALXProyecto;
        end;
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
        if Rec.Deleted then Error('El pedido ya esta eliminado.');
        if not Header.GetBySystemId(Rec."Header Id") then
            Error('El pedido original no existe; no se creara otro.');
        Header.TestField("Document Type", Header."Document Type"::Order);
        if Header.Status <> Header.Status::Released then begin
            Header.TestField(Status, Header.Status::Open);
            ReleaseDocument.PerformManualRelease(Header);
            Rec."Released At" := CurrentDateTime();
            Rec.Modify(true);
        end;
        Header.GetBySystemId(Rec."Header Id");
        Header.TestField(Status, Header.Status::Released);
        ActionContext.SetObjectType(ObjectType::Page);
        ActionContext.SetObjectId(Page::"EST Purchase Request API");
        ActionContext.AddEntityKey(Rec.FieldNo(Id), Rec.Id);
        ActionContext.SetResultCode(WebServiceActionResultCode::Updated);
    end;

    [ServiceEnabled]
    procedure abrir(var ActionContext: WebServiceActionContext)
    var
        Header: Record "Purchase Header";
        ReleaseDocument: Codeunit "Release Purchase Document";
    begin
        if Rec.Deleted then Error('El pedido ya esta eliminado.');
        if not Header.GetBySystemId(Rec."Header Id") then Error('El pedido original no existe.');
        Header.TestField("Document Type", Header."Document Type"::Order);
        if Header.Status <> Header.Status::Open then begin
            Header.TestField(Status, Header.Status::Released);
            ReleaseDocument.PerformManualReopen(Header);
        end;
        Header.GetBySystemId(Rec."Header Id");
        Header.TestField(Status, Header.Status::Open);
        ActionContext.SetObjectType(ObjectType::Page);
        ActionContext.SetObjectId(Page::"EST Purchase Request API");
        ActionContext.AddEntityKey(Rec.FieldNo(Id), Rec.Id);
        ActionContext.SetResultCode(WebServiceActionResultCode::Updated);
    end;

    [ServiceEnabled]
    procedure eliminar(var ActionContext: WebServiceActionContext)
    begin
        DeleteOrder();
        ActionContext.SetObjectType(ObjectType::Page);
        ActionContext.SetObjectId(Page::"EST Purchase Request API");
        ActionContext.AddEntityKey(Rec.FieldNo(Id), Rec.Id);
        ActionContext.SetResultCode(WebServiceActionResultCode::Updated);
    end;

    [CommitBehavior(CommitBehavior::Error)]
    local procedure DeleteOrder()
    var
        Header: Record "Purchase Header";
        Line: Record "Purchase Line";
        ReleaseDocument: Codeunit "Release Purchase Document";
    begin
        Rec.LockTable();
        Rec.Get(Rec.Id);
        if Rec.Deleted then exit;
        Header.LockTable();
        if not Header.GetBySystemId(Rec."Header Id") then
            Error('El pedido no esta disponible en BC. Puede haberse registrado o eliminado; no se eliminara otro documento.');
        Header.TestField("Document Type", Header."Document Type"::Order);
        if not (Header.Status in [Header.Status::Open, Header.Status::Released]) then
            Error('Solo se pueden eliminar pedidos abiertos o lanzados sin recepciones ni facturas.');
        Line.LockTable();
        Line.SetRange("Document Type", Header."Document Type");
        Line.SetRange("Document No.", Header."No.");
        if Line.FindSet() then repeat
            Line.TestField("Quantity Received", 0);
            Line.TestField("Quantity Invoiced", 0);
        until Line.Next() = 0;
        if Header.Status = Header.Status::Released then
            ReleaseDocument.PerformManualReopen(Header);
        Header.TestField(Status, Header.Status::Open);
        Header.Delete(true);
        Rec.Deleted := true;
        Rec."Deleted At" := CurrentDateTime();
        Rec.Modify(true);
    end;
}
