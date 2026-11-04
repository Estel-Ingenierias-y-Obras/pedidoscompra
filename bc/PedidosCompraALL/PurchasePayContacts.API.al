page 59118 "EST Purchase Contacts API"
{
    PageType = API;
    APIPublisher = 'estel'; APIGroup = 'purchase'; APIVersion = 'v1.0';
    EntityName = 'purchasePayContact'; EntitySetName = 'purchasePayContacts';
    SourceTable = Contact;
    ODataKeyFields = SystemId;
    InsertAllowed = false; ModifyAllowed = false; DeleteAllowed = false;
    layout { area(content) { repeater(General) {
        field(id; Rec.SystemId) { }
        field(number; Rec."No.") { }
        field(companyNumber; Rec."Company No.") { }
        field(name; Rec.Name) { }
    } } }
}
page 59119 "EST Purchase Vendor Links API"
{
    PageType = API;
    APIPublisher = 'estel'; APIGroup = 'purchase'; APIVersion = 'v1.0';
    EntityName = 'purchaseVendorContactLink'; EntitySetName = 'purchaseVendorContactLinks';
    SourceTable = "Contact Business Relation";
    SourceTableView = where("Link to Table" = const(Vendor));
    ODataKeyFields = SystemId;
    InsertAllowed = false; ModifyAllowed = false; DeleteAllowed = false;
    layout { area(content) { repeater(General) {
        field(id; Rec.SystemId) { }
        field(vendorNumber; Rec."No.") { }
        field(contactNumber; Rec."Contact No.") { }
    } } }
}
