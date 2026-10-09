page 60711 "GM Products"
{
    PageType = API;
    Caption = 'Productos';
    APIPublisher = 'Estel';
    APIGroup = 'GestionMaterial';
    APIVersion = 'v1.0';
    EntityName = 'producto';
    EntitySetName = 'productos';
    SourceTable = Item;
    ODataKeyFields = SystemId;
    Extensible = false;
    Editable = false;
    InsertAllowed = false;
    ModifyAllowed = false;
    DeleteAllowed = false;

    layout
    {
        area(Content)
        {
            repeater(General)
            {
                field(id; Rec.SystemId) { }
                field(numprod; Rec."No.") { }
                field(descripcion; Rec.Description) { }
                field(inventario; Rec.Inventory) { }
                field(codudmedida; Rec."Base Unit of Measure") { }
                field(costeunitario; Rec."Unit Cost") { }
                field(costeventa; Rec."Unit Price") { }
            }
        }
    }

    trigger OnOpenPage()
    begin
        Rec.FilterGroup(2);
        // Inventory must be calculated only for this location.
        Rec.SetRange("Location Filter", 'CENTRAL 3');
        Rec.SetFilter(Inventory, '>=%1', 1);
        Rec.FilterGroup(0);
    end;
}
