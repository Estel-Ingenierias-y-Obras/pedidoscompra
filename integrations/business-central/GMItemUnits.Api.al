page 60704 "GM Item Units"
{
    PageType = API;
    APIPublisher = 'Estel';
    APIGroup = 'GestionMaterial';
    APIVersion = 'v1.0';
    EntityName = 'unidadProducto';
    EntitySetName = 'unidadesProducto';
    SourceTable = "Item Unit of Measure";
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
                field(id; Rec."SystemId") { }
                field(numprod; Rec."Item No.") { }
                field(codigo; Rec."Code") { }
                field(factor; Rec."Qty. per Unit of Measure") { }
                field(precisioncantidad; Rec."Qty. Rounding Precision") { }
            }
        }
    }

    trigger OnOpenPage()
    var
        Management: Codeunit "GM Entry Management";
        ItemNo: Code[20];
    begin
        if Rec.GetFilter("Item No.") = '' then
            Error('Filtre numprod por un unico producto.');
        ItemNo := Rec.GetRangeMin("Item No.");
        if ItemNo <> Rec.GetRangeMax("Item No.") then
            Error('Filtre numprod por un unico producto.');
        Management.CheckItem(ItemNo);
        Rec.FilterGroup(2);
        Rec.SetRange("Item No.", ItemNo);
        Rec.SetFilter("Qty. per Unit of Measure", '>0');
        Rec.FilterGroup(0);
    end;
}

