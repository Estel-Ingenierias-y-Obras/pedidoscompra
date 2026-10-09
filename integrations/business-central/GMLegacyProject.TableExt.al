// Retain the 1.1 schema when updating an installation that used project journals.
// No project journal API or posting workflow is published by this version.
tableextension 60712 "GM Job Journal Integration" extends "Job Journal Line"
{
    fields
    {
        field(60701; "GM Integration Key"; Guid)
        {
            DataClassification = SystemMetadata;
            Editable = false;
        }
    }
    keys { key(GMIntegration; "GM Integration Key") { } }
}
