table 60702 "GM Entry Request"
{
    Caption = 'Peticiones de entradas de materiales';
    DataClassification = CustomerContent;
    Access = Internal;
    fields
    {
        field(1; "Integration Key"; Guid) { DataClassification = SystemMetadata; }
        field(2; Payload; Text[2048]) { }
        field(3; "Journal Line Id"; Guid) { DataClassification = SystemMetadata; }
        field(4; "Document No."; Code[20]) { }
        field(5; Posted; Boolean) { }
        field(6; "Posted At"; DateTime) { }
        // Keep the 1.1 fields for nondestructive upgrades; product posting never uses them.
        field(7; "Project Journal"; Boolean) { }
        field(8; "Job Ledger Entry No."; Integer) { }
        field(9; "Item Ledger Entry No."; Integer) { }
    }
    keys
    {
        key(PK; "Integration Key") { Clustered = true; }
        key(JournalLine; "Journal Line Id") { }
    }
}
