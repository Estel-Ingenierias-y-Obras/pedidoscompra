table 59112 "EST Purchase Request"
{
    DataClassification = CustomerContent;
    fields
    {
        field(1; Id; Guid) { }
        field(2; Fingerprint; Text[64]) { }
        field(3; "Header Id"; Guid) { }
        field(4; "Order No."; Code[20]) { }
        field(5; Deleted; Boolean) { }
        field(6; "Deleted At"; DateTime) { }
        field(7; "Header Status"; Enum "Purchase Document Status")
        {
            FieldClass = FlowField;
            CalcFormula = lookup("Purchase Header".Status where("Document Type" = const(Order), "No." = field("Order No."), SystemId = field("Header Id")));
        }
        field(8; "Released At"; DateTime) { }
    }
    keys { key(PK; Id) { Clustered = true; } }
}
