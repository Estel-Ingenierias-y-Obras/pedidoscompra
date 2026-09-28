page 60706 "GM Eligible Entries"
{
    PageType = API;
    APIPublisher = 'Estel';
    APIGroup = 'GestionMaterial';
    APIVersion = 'v1.0';
    EntityName = 'movimientoAplicable';
    EntitySetName = 'movimientosAplicables';
    SourceTable = "Item Ledger Entry";
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
                field(numero; Rec."Entry No.") { }
                field(numprod; Rec."Item No.") { }
                field(codalmacen; Rec."Location Code") { }
                field(fecha; Rec."Posting Date") { }
                field(documento; Rec."Document No.") { }
                field(cantidadpendientebase; Rec."Remaining Quantity") { }
                field(abierto; Rec."Open") { }
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
        Rec.SetRange("Location Code", 'CENTRAL 3');
        Rec.SetRange("Variant Code", '');
        Rec.SetRange(Open, true);
        Rec.SetRange(Positive, false);
        Rec.SetFilter("Remaining Quantity", '<0');
        Rec.SetRange("Serial No.", '');
        Rec.SetRange("Lot No.", '');
        Rec.SetRange("Package No.", '');
        Rec.FilterGroup(0);
    end;
}

