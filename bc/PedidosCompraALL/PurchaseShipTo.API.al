page 59115 "EST Purchase Ship-to API"
{
    PageType = API;
    APIPublisher = 'estel';
    APIGroup = 'purchase';
    APIVersion = 'v1.0';
    EntityName = 'purchaseShipToAddress';
    EntitySetName = 'purchaseShipToAddresses';
    SourceTable = "Ship-to Address";
    ODataKeyFields = SystemId;
    InsertAllowed = false;
    ModifyAllowed = false;
    DeleteAllowed = false;
    layout { area(content) { repeater(General) {
        field(id; Rec.SystemId) { }
        field(customerNumber; Rec."Customer No.") { }
        field(code; Rec.Code) { }
        field(name; Rec.Name) { }
        field(address; Rec.Address) { }
        field(city; Rec.City) { }
        field(name2; Rec."Name 2") { }
        field(address2; Rec."Address 2") { }
        field(county; Rec.County) { }
        field(postCode; Rec."Post Code") { }
        field(countryCode; Rec."Country/Region Code") { }
        field(phoneNumber; Rec."Phone No.") { }
        field(contact; Rec.Contact) { }
    } } }
}
