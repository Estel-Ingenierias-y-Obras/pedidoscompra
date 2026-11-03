page 59114 "EST Purchase Tasks API"
{
    PageType = API;
    APIPublisher = 'estel';
    APIGroup = 'purchase';
    APIVersion = 'v1.0';
    EntityName = 'purchaseJobTask';
    EntitySetName = 'purchaseJobTasks';
    SourceTable = "Job Task";
    ODataKeyFields = SystemId;
    InsertAllowed = false;
    ModifyAllowed = false;
    DeleteAllowed = false;
    layout { area(content) { repeater(General) {
        field(id; Rec.SystemId) { }
        field(jobNumber; Rec."Job No.") { }
        field(number; Rec."Job Task No.") { }
        field(description; Rec.Description) { }
        field(taskType; Rec."Job Task Type") { }
    } } }
}
