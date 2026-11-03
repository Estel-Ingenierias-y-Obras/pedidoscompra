table 59112 "EST Purchase Request"
{
    DataClassification = CustomerContent;
    fields
    {
        field(1; Id; Guid) { }
        field(2; Fingerprint; Text[64]) { }
        field(3; "Header Id"; Guid) { }
        field(4; "Order No."; Code[20]) { }
    }
    keys { key(PK; Id) { Clustered = true; } }
}
