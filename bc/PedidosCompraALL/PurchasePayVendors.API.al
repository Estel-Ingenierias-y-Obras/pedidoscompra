page 59120 "EST Purchase Pay Vendors API"
{
    PageType = API;
    APIPublisher = 'estel'; APIGroup = 'purchase'; APIVersion = 'v1.0';
    EntityName = 'purchasePayVendor'; EntitySetName = 'purchasePayVendors';
    SourceTable = Vendor;
    ODataKeyFields = SystemId;
    InsertAllowed = false; ModifyAllowed = false; DeleteAllowed = false;
    layout { area(content) { repeater(General) {
        field(id; Rec.SystemId) { }
        field(number; Rec."No.") { }
        field(name; Rec.Name) { }
        field(direccion; Rec.Address) { }
        field(direccion2; Rec."Address 2") { }
        field(ciudad; Rec.City) { }
        field(provincia; Rec.County) { }
        field(codigoPostal; Rec."Post Code") { }
        field(pais; Rec."Country/Region Code") { }
        field(contacto; Rec.Contact) { }
        field(codigoContacto; Rec."Primary Contact No.") { }
    } } }
}
