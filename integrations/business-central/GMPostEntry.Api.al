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
                field(claveintegracion; IntegrationKey) { }
                field(idlinea; LineId) { }
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
        Rec.FilterGroup(0);
    end;
    trigger OnNewRecord(BelowxRec: Boolean)
    begin
        Clear(IntegrationKey);
        Clear(LineId);
    end;
    trigger OnInsertRecord(BelowxRec: Boolean): Boolean
    begin
        Management.PostEntry(IntegrationKey, LineId, Rec);
        LoadResponse();
        exit(false);
    end;
    trigger OnAfterGetRecord()
    begin
        LoadResponse();
    end;
    local procedure LoadResponse()
    begin
        IntegrationKey := Rec."Integration Key";
        LineId := Rec."Journal Line Id";
    end;
    var
        Management: Codeunit "GM Post Management";
        IntegrationKey: Guid;
        LineId: Guid;
}
