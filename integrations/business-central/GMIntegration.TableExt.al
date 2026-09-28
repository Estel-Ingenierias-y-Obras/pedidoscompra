tableextension 60701 "GM Journal Integration" extends "Item Journal Line"
{
    fields
    {
        field(60701; "GM Integration Key"; Guid)
        {
            Caption = 'Clave de integracion de materiales';
            DataClassification = SystemMetadata;
            Editable = false;
        }
    }
    keys
    {
        key(GMIntegration; "GM Integration Key") { }
    }
}
