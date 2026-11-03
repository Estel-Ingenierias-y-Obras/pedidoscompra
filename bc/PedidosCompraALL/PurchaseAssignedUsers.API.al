page 59113 "EST Purchase Users API"
{
    PageType = API;
    APIPublisher = 'estel';
    APIGroup = 'purchase';
    APIVersion = 'v1.0';
    EntityName = 'assignedPurchaseUser';
    EntitySetName = 'assignedPurchaseUsers';
    SourceTable = "User Setup";
    ODataKeyFields = SystemId;
    InsertAllowed = false;
    ModifyAllowed = false;
    DeleteAllowed = false;
    layout { area(content) { repeater(General) {
        field(id; Rec.SystemId) { }
        field(userId; Rec."User ID") { }
    } } }
}
