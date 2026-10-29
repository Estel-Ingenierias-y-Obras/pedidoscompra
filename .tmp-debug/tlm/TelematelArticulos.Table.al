table 58010 "Telematel Articulos"
{
    LookupPageId = "Telematel Articulos";
    DrillDownPageId = "Telematel Articulos";

    fields
    {
        field(1; Id; Integer)
        {
            AutoIncrement = true;
            Editable = False;
        }
        field(5; CodArt; Code[20])
        {
            Caption = 'Código';
            NotBlank = True;
        }
        field(6; Referencia; text[40])
        {
        }
        field(10; Descripcion; text[80])
        {
        }
        field(20; "Id Marca"; Integer)
        {
            NotBlank = true;
            TableRelation = "Telematel Marcas".Id;

            trigger OnValidate()
            var
                lrMarca: Record "Telematel Marcas";
            begin
                IF "Id Marca" = 0 THEN
                    "Codigo Marca" := ''
                ELSE BEGIN
                    lrMarca.GET("Id Marca");
                    "Codigo Marca" := lrMarca.Codigo;
                END;
            end;
        }
        field(21; "Codigo Marca"; code[30])
        {
            Caption = 'Código Marca';
            Editable = False;
        }
        field(30; "CodigoUnidad"; code[4])
        {
            TableRelation = "Telematel Unidades";
        }
        field(31; "Unidad UN20"; code[5])
        {
            TableRelation = "Unidades UN20"."UN20 Code";
        }
        field(50; "No.Item"; code[20])
        {
            Caption = 'Nº Item';
            TableRelation = Item;

            trigger OnValidate()
            var
                lrClaArt: record "Clasificacion Articulos";
            begin
                IF (Id <> 0) THEN BEGIN
                    CLEAR(lrClaArt);
                    lrClaArt.SETRANGE("Id Articulo", Id);
                    IF NOT lrClaArt.ISEMPTY then lrClaArt.MODIFYALL("Cod Item", "No.Item");
                END;
            end;
        }
        field(60; "Series Estel"; code[10])
        {
            TableRelation = "Telematel Series Estel".Codigo WHERE("Id Marca" = FIELD("Id Marca"));
        }
        field(70; "GOCAT Unique Id"; code[20])
        {
        }
        field(80; EAN; code[40])
        {
        }
        field(100; "UltimaActualizacion"; DateTime)
        {
        }
        field(101; "Ultima Actualizacion GOCAT"; DateTime)
        {
        }
        field(105; Activo; Boolean)
        {
            trigger OnValidate()
            var
                lrItem: Record Item;
                lwBorrar: Boolean;
                lwEnc: Boolean;
            begin
                IF Activo <> xRec.Activo THEN BEGIN
                    lwBorrar := FALSE;
                    IF Activo AND Eliminado THEN BEGIN
                        Activo := FALSE;
                        EXIT;
                    END;
                    lwEnc := "No.Item" <> '';
                    IF lwEnc THEN BEGIN
                        CLEAR(lrItem);
                        lwEnc := lrItem.GET("No.Item");
                        IF lwEnc THEN BEGIN
                            IF (Activo = FALSE) THEN lwBorrar := lrItem.PuedeBorrarse();
                            IF lwBorrar THEN BEGIN
                                lrItem.DELETE(TRUE);
                                "No.Item" := '';
                            END
                            ELSE BEGIN
                                // Bloqueado y Activo son conceptos opuestos
                                IF lrItem.Blocked <> (NOT Activo) THEN
                                    lrItem.VALIDATE(Blocked, NOT Activo);
                                lrItem.MODIFY();
                            END;
                        END;
                    END;
                end;
            end;
        }
        field(110; Eliminado; Boolean)
        {
            trigger OnValidate()
            begin
                IF Eliminado THEN VALIDATE(Activo, FALSE);
            end;
        }
        field(115; Perdido; Boolean)
        {
            trigger OnValidate()
            begin
                IF Perdido THEN VALIDATE(Activo, FALSE);
            end;
        }
        field(200; "Tipo Clasificacion filter"; Integer)
        {
            FieldClass = FlowFilter;
            TableRelation = "Tipos Clasificacion".Id;
        }
        field(201; "Classif 1"; text[60])
        {
            FieldClass = FlowField;
            CalcFormula = Lookup(Clasificaciones.Descripcion WHERE(Id = FIELD("Id N1")));
        }
        field(202; "Classif 2"; text[60])
        {
            FieldClass = FlowField;
            CalcFormula = Lookup(Clasificaciones.Descripcion WHERE(Id = FIELD("Id N2")));
        }
        field(203; "Classif 3"; text[60])
        {
            FieldClass = FlowField;
            CalcFormula = Lookup(Clasificaciones.Descripcion WHERE(Id = FIELD("Id N3")));
        }
        field(251; "Id N1"; Integer)
        {
            FieldClass = FlowField;
            CalcFormula = Lookup("Clasificacion Articulos".N1 WHERE("Id Articulo" = FIELD(Id), "Codigo Clasificacion" = FIELD("Tipo Clasificacion filter")));
            Editable = False;
        }
        field(252; "Id N2"; Integer)
        {
            FieldClass = FlowField;
            CalcFormula = Lookup("Clasificacion Articulos".N2 WHERE("Id Articulo" = FIELD(Id), "Codigo Clasificacion" = FIELD("Tipo Clasificacion filter")));
            Editable = False;
        }
        field(253; "Id N3"; Integer)
        {
            FieldClass = FlowField;
            CalcFormula = Lookup("Clasificacion Articulos".N3 WHERE("Id Articulo" = FIELD(Id), "Codigo Clasificacion" = FIELD("Tipo Clasificacion filter")));
            Editable = False;
        }
        field(300; "Base Unit OF Measure"; code[10])
        {
            Caption = 'Unidad de Medida Base';
            FieldClass = FlowField;
            CalcFormula = Lookup(Item."Base Unit of Measure" WHERE("No." = FIELD("No.Item")));
            Editable = false;
        }
        field(350; "Precio Libre"; Boolean)
        {
            FieldClass = FlowField;
            CalcFormula = Lookup("Telematel Series Estel"."Precio Libre" WHERE("Id Marca" = FIELD("Id Marca"), Codigo = FIELD("Series Estel")));
            Editable = False;
            blankZero = True;
        }
        field(370; Capitulo; Enum Capitulo)
        {
            Caption = 'Capítulo';

            trigger OnValidate()
            begin
                SinArticulo();
            end;
        }
    }
    keys
    {
        key(Key1; Id)
        {
            Clustered = true;
        }
        key(key2; "Id Marca", CodArt)
        {
        }
        key(Key3; "No.Item")
        {
        }
        key(Key4; "Id Marca", Referencia)
        {
        }
        key(Key5; "Codigo Marca", CodArt)
        {
        }
    }
    var
        cGestGoCat: Codeunit GestGoCatalog;
        wFiltroClass: array[3] OF Text;
        wFiltroClassId: array[3] of Integer;

    trigger OnInsert()
    begin
        TESTFIELD(CodArt);
        TESTFIELD("Id Marca");
        CompDupl();
    end;

    trigger OnModify()
    begin
        CompDupl();
    end;

    trigger OnDelete()
    begin
        BorraReferencias();
    end;

    procedure CompDupl()
    var
        lrArt: record "Telematel Articulos";
    begin
        // Comprueba Duplicidades
        CLEAR(lrArt);
        lrArt.SETCURRENTKEY("Id Marca", CodArt);
        lrArt.SETRANGE(CodArt, CodArt);
        lrArt.SETRANGE("Id Marca", "Id Marca");
        lrArt.SETFILTER(Id, '<>%1', Id);
        IF lrArt.IsEmpty() THEN ERROR('Ya existe el articulo %1 para la marca %2', CodArt, "Id Marca");
    end;

    procedure AsignaSeriaAFiltrados(pwIdMarca: Integer)
    var
        lrSeries: Record "Telematel Series Estel";
        lwTotal: Integer;
    begin
        // Asigna una serie a todos los registros filtrados
        lwTotal := COUNT;
        IF lwTotal = 0 THEN EXIT;
        CLEAR(lrSeries);
        lrSeries.FILTERGROUP(2);
        lrSeries.SETRANGE("Id Marca", pwIdMarca);
        lrSeries.FILTERGROUP(2);
        IF lrSeries.COUNT = 0 THEN ERROR('NO se ha encontrada ninguna seria Estel para esta  marca');
        IF PAGE.RUNMODAL(0, lrSeries) <> ACTION::LookupOK THEN EXIT;
        IF NOT CONFIRM('¿Desea asignar la serie %1 a los %2 artículos filtrados?', TRUE, lrSeries.Codigo, lwTotal) THEN EXIT;
        MODIFYALL("Series Estel", lrSeries.Codigo);
    end;
    //     procedure GetClasLevelName(pwLevel: Integer) wName: Text
    //     var
    //         lrClasArt: record "Clasificacion Articulos";
    //     begin
    //         CLEAR(wName);
    //         CLEAR(lrClasArt);
    //         lrClasArt.SETRANGE("Codigo Clasificacion", "Tipo Clasificacion filter");
    //         lrClasArt.SETRANGE("Id Articulo", Id);
    //         IF lrClasArt.FINDFIRST THEN BEGIN
    //             lrClasArt.CALCFIELDS("Nivel 1", "Nivel 2", "Nivel 3");
    //             wName := lrClasArt.GetLevelText(pwLevel);
    //         END;
    //     end;
    //     procedure GetClasValues(VAR pwFiltrosNom: ARRAY[3] OF Text; VAR pwFiltrosId: ARRAY[3] OF Integer)
    //     begin
    //         COPYARRAY(pwFiltrosId, wFiltroClassId, 1);
    //         COPYARRAY(pwFiltrosNom, wFiltroClass, 1);
    //     end;
    //     procedure SetClasValues(pwFiltrosNom: ARRAY[3] OF Text; pwFiltrosId: ARRAY[3] OF Integer)
    //     begin
    //         COPYARRAY(wFiltroClassId, pwFiltrosId, 1);
    //         COPYARRAY(wFiltroClass, pwFiltrosNom, 1);
    //     end;
    procedure SinArticulo()
    var
        lrItem: record Item;
    begin
        // Sincroniza con Articulo Nav
        IF "No.Item" <> '' THEN
            IF lrItem.GET("No.Item") THEN
                IF Capitulo <> lrItem.Capitulo THEN BEGIN
                    lrItem.Capitulo := Capitulo;
                    lrItem.MODIFY();
                END;
    end;

    procedure ShowItemPage()
    var
        lrItem: record item;
    begin
        IF "No.Item" = '' THEN EXIT;
        IF lrItem.GET("No.Item") THEN PAGE.RUN(30, lrItem);
    end;
    //     procedure FiltraLevel(pwLevel: Integer; pwId: Integer; pwName: Text)
    //     begin
    //         AsingLevel(pwLevel, pwId, pwName);
    //         FiltraClass; // update page        
    //     end;
    procedure FiltraClass()
    var
        lwUltnivel: Integer;
        lwN: Integer;
    begin
        lwUltnivel := 0;
        FOR lwN := 1 TO 3 DO
            IF wFiltroClassId[lwN] > 0 THEN lwUltnivel := lwN;
        IF lwUltnivel = 1 THEN
            SETRANGE("Id N1", wFiltroClassId[1])
        ELSE
            SETRANGE("Id N1");
        IF lwUltnivel = 2 THEN
            SETRANGE("Id N2", wFiltroClassId[2])
        ELSE
            SETRANGE("Id N2");
        IF lwUltnivel = 3 THEN
            SETRANGE("Id N3", wFiltroClassId[3])
        ELSE
            SETRANGE("Id N3");
    end;

    procedure AsingLevel(pwLevel: Integer; pwId: Integer; pwDescription: Text)
    var
        lwId: integer;
    begin
        IF pwId = 0 then pwDescription := '';
        wFiltroClassId[pwLevel] := pwId;
        wFiltroClass[pwLevel] := pwDescription;
        IF pwLevel < 3 THEN
            FOR lwId := pwLevel + 1 TO 3 DO AsingLevel(lwId, 0, '');
    end;

    procedure FindLevel(pwLevel: Integer; pwId: Integer) Result: Text
    var
        lrClasf: Record Clasificaciones;
        lwParentId: Integer;
    begin
        CLEAR(Result);
        CLEAR(lrClasf);
        IF pwId > 0 THEN BEGIN
            lwParentId := 0;
            IF pwLevel > 1 THEN lwParentId := wFiltroClassId[pwLevel - 1];
            // De paso comprobamos coherencia
            lrClasf.SETRANGE("Id Subordinado", lwParentId);
            lrClasf.SETRANGE(Id, pwId);
            lrClasf.SETRANGE(Nivel, pwLevel);
            lrClasf.FINDFIRST();
            Result := lrClasf.Descripcion;
        END;
    end;

    procedure GetClasLevelNames(VAR pwClasNames: ARRAY[3] OF Text[60])
    var
        lrClasArt: Record "Clasificacion Articulos";
        lwLevel: Integer;
    begin
        CLEAR(pwClasNames);
        CLEAR(lrClasArt);
        COPYFILTER("Tipo Clasificacion filter", lrClasArt."Codigo Clasificacion");
        lrClasArt.SETRANGE("Id Articulo", Id);
        IF lrClasArt.FINDFIRST() THEN BEGIN
            lrClasArt.CALCFIELDS("Nivel 1", "Nivel 2", "Nivel 3");
            FOR lwLevel := 1 TO 3 DO pwClasNames[lwLevel] := CopyStr(lrClasArt.GetLevelText(lwLevel), 1, 60);
        END;
    end;

    procedure GetFiltroCodClassText() wText: Text
    var
        lrCodlasf: Record "Tipos Clasificacion";
        lwFilt: Integer;
    begin
        wText := '';
        IF GETFILTER("Tipo Clasificacion filter") <> '' THEN BEGIN
            lwFilt := GETRANGEMIN("Tipo Clasificacion filter");
            IF lrCodlasf.GET(lwFilt) THEN wText := STRSUBSTNO('%1 - %2', lrCodlasf.Id, lrCodlasf.Nombre);
        END;
    end;

    procedure GestFiltrosTree(VAR pwIdTipoClass: Integer) wResult: Boolean
    var
        lrClass: Record Clasificaciones;
        lrTipoC: Record "Tipos Clasificacion";
        lwPageTree: Page "Clasificaciones Tree";
        lwUltnivel: Integer;
        lwN: Integer;
        lwId: Integer;
        lwOk: Boolean;
        lwIdMarca: Integer;
    begin
        lwUltnivel := 0;
        FOR lwN := 1 TO 3 DO
            IF wFiltroClassId[lwN] > 0 THEN lwUltnivel := lwN;
        lwId := 0;
        IF lwUltnivel > 0 THEN lwId := wFiltroClassId[lwUltnivel];
        IF lwUltnivel = 0 THEN BEGIN
            CALCFIELDS("Id N1", "Id N2", "Id N3");
            IF "Id N3" <> 0 THEN
                lwId := "Id N3"
            ELSE
                IF "Id N2" <> 0 THEN
                    lwId := "Id N2"
                ELSE
                    IF "Id N1" <> 0 THEN lwId := "Id N1";
        END;
        CLEAR(lwIdMarca);
        IF NOT lrTipoC.GET(pwIdTipoClass) THEN CLEAR(lrTipoC);
        IF lrTipoC.SubType = lrTipoC.SubType::brand THEN lwIdMarca := "Id Marca";
        CLEAR(lwPageTree);
        lwPageTree.RellenaTemp(pwIdTipoClass, lwId, lwIdMarca);
        lwPageTree.LOOKUPMODE := TRUE;
        wResult := lwPageTree.RUNMODAL() = ACTION::LookupOK;
        IF wResult THEN BEGIN
            lwId := lwPageTree.GetId();
            IF lwId <> 0 THEN BEGIN
                CLEAR(wFiltroClassId);
                CLEAR(wFiltroClass);
                IF lrClass.GET(lwId) THEN BEGIN
                    pwIdTipoClass := lrClass."Tipo Clasificacion";
                    REPEAT
                        wFiltroClassId[lrClass.Nivel] := lrClass.Id;
                        wFiltroClass[lrClass.Nivel] := lrClass.Descripcion;
                        lwOk := lrClass.GET(lrClass."Id Subordinado");
                    UNTIL NOT lwOk;
                END
                ELSE
                    IF lwId < 0 THEN BEGIN
                        lwId := -lwId;
                        pwIdTipoClass := lwId;
                    END;
            END;
        END;
    end;

    procedure GetClassFullText() Result: Text
    var
        lwN: integer;
    begin
        CLEAR(Result);
        FOR lwN := 1 TO 3 DO
            IF wFiltroClass[lwN] <> '' THEN BEGIN
                IF Result <> '' THEN Result += ' / ';
                Result += wFiltroClass[lwN];
            END;
        IF Result = '' THEN Result := '<Filtro de Clasificaciones>';
        Result := PADSTR('', 10, ' ') + Result;
    end;

    procedure ClearFiltrosClass()
    begin
        CLEAR(wFiltroClassId);
        CLEAR(wFiltroClass);
    end;

    procedure GetFiltroClassId(pwLevel: Integer) Result: Integer
    begin
        Result := wFiltroClassId[pwLevel];
    end;

    procedure GetFiltroClass(pwLevel: Integer) Result: Text
    begin
        Result := wFiltroClass[pwLevel];
    end;

    procedure SetFilterPageFilters(VAR pwFiltPage: Page "Filtros Clasificacion")
    begin
        pwFiltPage.SetValues(wFiltroClass, wFiltroClassId);
    end;

    procedure FilterPageGetValues(VAR pwFiltPage: Page "Filtros Clasificacion")
    begin
        pwFiltPage.GetValues(wFiltroClass, wFiltroClassId)
    end;

    procedure RiseLevel() Result: Boolean
    var
        lwLevel: integer;
    begin
        lwLevel := GetLastClassFilterLevel();
        Result := lwLevel > 0;
        IF Result THEN BEGIN
            AsingLevel(lwLevel, 0, '');
            FiltraClass();
        END;
    end;

    procedure GetLastClassFilterLevel() Result: Integer
    var
        lwN: integer;
    begin
        Result := 0;
        FOR lwN := 1 TO 3 DO
            IF wFiltroClassId[lwN] > 0 THEN Result := lwN;
    end;

    procedure GetItemCode() Result: Code[20]
    var
        lrMarca: record "Telematel Marcas";
        lwCreate: Boolean;
    begin
        // Crea el Producto Nav si no existe
        // #321633 Mejoras Modulo Go Catalog JPT 16/07/2020        
        lwCreate := "No.Item" = '';
        IF lwCreate THEN
            IF lrMarca.GET("Id Marca") THEN BEGIN
                cGestGoCat.UpdateItem(Rec, lrMarca);
                MODIFY();
            END;
        Result := "No.Item";
    end;

    local procedure BorraReferencias()
    var
        lrRef: Record "GOCAT Referencias Articulos";
        lrClass: Record "Clasificacion Articulos";
        lrPrec: Record "Telematel Precios Articulo";
    begin
        IF Id = 0 THEN EXIT;
        CLEAR(lrRef);
        lrRef.SETCURRENTKEY("Id Articulo");
        lrRef.SETRANGE("Id Articulo", Id);
        IF NOT lrRef.ISEMPTY then lrRef.DELETEALL();
        CLEAR(lrClass);
        lrClass.SETRANGE("Id Articulo", Id);
        IF NOT lrClass.ISEMPTY THEN lrClass.DELETEALL();
        CLEAR(lrPrec);
        lrPrec.SETCURRENTKEY(IdArticulo);
        lrPrec.SETRANGE(IdArticulo, Id);
        IF NOT lrPrec.ISEMPTY THEN lrPrec.DELETEALL();
    end;
}
