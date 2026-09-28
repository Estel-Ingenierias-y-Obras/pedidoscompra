page 60705 "GM Project Types"
{
    PageType = API;
    APIPublisher = 'Estel';
    APIGroup = 'GestionMaterial';
    APIVersion = 'v1.0';
    EntityName = 'tipoProyecto';
    EntitySetName = 'tiposProyecto';
    SourceTable = "Dimension Value";
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
                field(dimension; Rec."Dimension Code") { }
                field(codigo; Rec."Code") { }
                field(nombre; Rec."Name") { }
                field(bloqueado; Rec."Blocked") { }
                field(tipo; Rec."Dimension Value Type") { }
            }
        }
    }

    trigger OnOpenPage()
    var
        Dimension: Record Dimension;
    begin
        Dimension.Get('TIPO PROYECTO');
        Dimension.TestField(Blocked, false);
        Rec.FilterGroup(2);
        Rec.SetRange("Dimension Code", Dimension.Code);
        Rec.SetFilter(Code, 'DIRECTO|INDIRECTO|GRUPO');
        Rec.SetRange(Blocked, false);
        Rec.SetRange("Dimension Value Type", Rec."Dimension Value Type"::Standard);
        Rec.FilterGroup(0);
    end;
}

