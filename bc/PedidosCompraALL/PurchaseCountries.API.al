page 59117 "EST Purchase Countries API"
{
    PageType = API;
    APIPublisher = 'estel';
    APIGroup = 'purchase';
    APIVersion = 'v1.0';
    EntityName = 'purchaseCountry';
    EntitySetName = 'purchaseCountries';
    SourceTable = "Country/Region";
    ODataKeyFields = SystemId;
    InsertAllowed = false;
    ModifyAllowed = false;
    DeleteAllowed = false;
    layout { area(content) { repeater(General) {
        field(id; Rec.SystemId) { }
        field(code; Rec.Code) { }
        field(name; Rec.Name) { }
    } } }
}
