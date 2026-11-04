page 59121 "EST Purchase Project Address"
{
    PageType = API;
    APIPublisher = 'estel'; APIGroup = 'purchase'; APIVersion = 'v1.0';
    EntityName = 'purchaseProjectAddress'; EntitySetName = 'purchaseProjectAddresses';
    SourceTable = Job;
    ODataKeyFields = SystemId;
    InsertAllowed = false; ModifyAllowed = false; DeleteAllowed = false;
    layout { area(content) { repeater(General) {
        field(id; Rec.SystemId) { }
        field(number; Rec."No.") { }
        field(name; Rec."Ship-to Name") { }
        field(name2; Rec."Ship-to Name 2") { }
        field(address; Rec."Ship-to Address") { }
        field(address2; Rec."Ship-to Address 2") { }
        field(city; Rec."Ship-to City") { }
        field(county; Rec."Ship-to County") { }
        field(postCode; Rec."Ship-to Post Code") { }
        field(countryCode; Rec."Ship-to Country/Region Code") { }
        field(contact; Rec."Ship-to Contact") { }
        field(phoneNumber; Rec."Sell-to Phone No.") { }
    } } }
}
