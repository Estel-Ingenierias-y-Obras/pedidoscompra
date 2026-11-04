page 59116 "EST Purchase Company API"
{
    PageType = API;
    APIPublisher = 'estel';
    APIGroup = 'purchase';
    APIVersion = 'v1.0';
    EntityName = 'purchaseCompanyAddress';
    EntitySetName = 'purchaseCompanyAddresses';
    SourceTable = "Company Information";
    ODataKeyFields = SystemId;
    InsertAllowed = false;
    ModifyAllowed = false;
    DeleteAllowed = false;
    layout { area(content) { repeater(General) {
        field(id; Rec.SystemId) { }
        field(name; Rec.Name) { }
        field(name2; Rec."Name 2") { }
        field(address; Rec.Address) { }
        field(address2; Rec."Address 2") { }
        field(city; Rec.City) { }
        field(county; Rec.County) { }
        field(postCode; Rec."Post Code") { }
        field(countryCode; Rec."Country/Region Code") { }
        field(phoneNumber; Rec."Phone No.") { }
        field(contact; Rec."Contact Person") { }
    } } }
}
