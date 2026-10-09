page 60708 "GM Post Entry"
{
    PageType = API;
    APIPublisher = 'Estel';
    APIGroup = 'GestionMaterial';
    APIVersion = 'v1.0';
    EntityName = 'registroProducto';
    EntitySetName = 'registrosProducto';
    SourceTable = "GM Entry Request";
    ODataKeyFields = SystemId;
    DelayedInsert = true;
    ModifyAllowed = false;
    DeleteAllowed = false;
    Extensible = false;
    Permissions = tabledata "GM Entry Request" = RI;
    layout
    {
        area(Content)
        {
            repeater(Entries)
            {
                field(id; Rec.SystemId) { Editable = false; }
                field(claveintegracion; Rec."Integration Key") { }
                field(idlinea; Rec."Journal Line Id") { }
                field(numdoc; Rec."Document No.") { Editable = false; }
                field(registrado; Rec.Posted) { Editable = false; }
                field(fecharegistrocontable; Rec."Posted At") { Editable = false; }
            }
        }
    }
    trigger OnOpenPage()
    begin
        Rec.FilterGroup(2);
        Rec.SetRange(Posted, true);
        Rec.SetRange("Project Journal", false);
        Rec.FilterGroup(0);
    end;
    trigger OnNewRecord(BelowxRec: Boolean)
    begin
        Clear(Rec."Integration Key");
        Clear(Rec."Journal Line Id");
    end;
    trigger OnInsertRecord(BelowxRec: Boolean): Boolean
    begin
        Management.PostEntry(Rec."Integration Key", Rec."Journal Line Id", Rec);
        Rec.TestField(Posted, true);
        Rec.TestField("Document No.");
        Rec.TestField("Posted At");
        exit(false);
    end;
    var
        Management: Codeunit "GM Post Management";
}
