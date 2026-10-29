tableextension 58003 Item extends Item
{
    fields
    {
        //         field(50000; "PVP Instalado"; Decimal)
        //         {
        //             AutoFormatType = 2;
        //         }
        //         field(50001; "Importe mano obra L.M"; Decimal)
        //         {
        //             FieldClass = FlowField;
        //             CalcFormula = Sum("BOM Component"."Importe coste" WHERE("Parent Item No." = FIELD("No."), Type = CONST(Resource)));
        //         }
        //         field(50003; "Importe vta. mano obra L.M."; Decimal)
        //         {
        //             FieldClass = FlowField;
        //             CalcFormula = Sum("BOM Component"."Importe venta" WHERE("Parent Item No." = FIELD("No."), Type = CONST(Resource)));
        //         }
        //         field(50004; "Importe vta. prods. L.M."; Decimal)
        //         {
        //             FieldClass = FlowField;
        //             CalcFormula = Sum("BOM Component"."Importe venta" WHERE("Parent Item No." = FIELD("No."), Type = CONST(Item)));
        //         }
        //         field(50005; "Cod. familia"; Code[20])
        //         {
        //             //DCR
        //             TableRelation = Familias;
        //             //Tabla Familias: 7010625. No tengo acceso a ella
        //             //DCR
        //         }
        //         field(50006; "Cod. Subfamilia"; Code[20])
        //         {
        //             //DCR
        //             TableRelation = Subfamilias."Cod. subfamilia" WHERE("Cod. familia" = FIELD("Cod. familia"));
        //             //Tabla Subfamilias: 7010626; No tengo acceso a ella
        //             //DCR
        //         }
        //         field(50007; "Cod. marca"; Code[20])
        //         {
        //             //DCR
        //             TableRelation = Marcas;
        //             //Tabla Marcas: 7010628;
        //             //DCR
        //         }
        //         field(50008; "Ubicacion Noufred"; Code[10])
        //         {
        //             //DCR
        //             TableRelation = "Ubicaciones Noufred";
        //             //Tabla Ubicaciones Noufred: 7010480;
        //             //DCR
        //         }
        //         field(50009; "Ubicacion Estel"; Code[10])
        //         {
        //             TableRelation = "Ubicaciones Estel";
        //             //Tabla 7010481;
        //         }
        //         field(50010; "Cod. grupo"; Code[20])
        //         {
        //             TableRelation = "Grupos subfamilias"."Cod. grupo" WHERE("Cod. familia" = FIELD("Cod. familia"), "Cod. subfamilia" = FIELD("Cod. subfamilia"));
        //             //Tabla 7010484
        //         }
        //         field(50011; "Cod. Prod. fabricante"; Code[20])
        //         { }
        //         field(50012; "Cod. producto importado"; Code[20])
        //         { }
        //         field(50013; "Nombre fabricante"; Text[50])
        //         { }
        field(50100; "Id Marca TLM"; Integer)
        {
            TableRelation = "Telematel Marcas".Id;

            trigger OnValidate()
            var
                lrMarcaTLM: Record "Telematel Marcas";
            begin
                IF lrMarcaTLM.GET("Id Marca TLM") THEN
                    "Marca TLM" := lrMarcaTLM.Codigo
                ELSE
                    "Marca TLM" := '';
                VALIDATE("Id Articulo TLM", 0); // Borramos el codigo de art¡culo
            end;
        }
        field(50101; "Marca TLM"; Code[30])
        {
            CaptionML = ESP = 'Marca TLM';
            Editable = false;

            trigger OnLookup()
            var
                lrMarcaTLM: Record "Telematel Marcas";
            begin
                CLEAR(lrMarcaTLM);
                lrMarcaTLM.Id := "Id Marca TLM";
                IF PAGE.RUNMODAL(0, lrMarcaTLM) = ACTION::LookupOK THEN 
                    VALIDATE("Id Marca TLM", lrMarcaTLM.Id);
            end;
        }
        field(50102; "Id Articulo TLM"; Integer)
        {
            TableRelation = "Telematel Articulos".Id WHERE("Id Marca" = FIELD("Id Marca TLM"));

            trigger OnValidate()
            var
                lrArtTLM: Record "Telematel Articulos";
            begin
                IF lrArtTLM.GET("Id Articulo TLM") THEN
                    "Referencia TLM" := lrArtTLM.Referencia
                ELSE
                    "Referencia TLM" := '';
            end;
        }
        field(50103; "Referencia TLM"; Text[40])
        {
            CaptionML = ESP = 'Referencia TLM';
            Editable = false;

            trigger OnLookup()
            var
                lrArtTLM: Record "Telematel Articulos";
            begin
                CLEAR(lrArtTLM);
                lrArtTLM.Id := "Id Articulo TLM";
                lrArtTLM.SETRANGE("Id Marca", "Id Marca TLM");
                IF PAGE.RUNMODAL(0, lrArtTLM) = ACTION::LookupOK THEN BEGIN
                    "Id Articulo TLM" := lrArtTLM.Id;
                    "Referencia TLM" := lrArtTLM.Referencia;
                END;
            end;
        }
        field(50105; Capitulo; Enum Capitulo)
        {
            Caption = 'Capítulo';

            trigger OnValidate()
            var
                lrArtTlm: Record "Telematel Articulos";
            begin
                // Actulizamos el valor en articulos Telematel
                IF "No." = '' THEN EXIT;
                // En principio unicamente deber¡a de existir un solo registro Articulo Telematel.
                // El modifyall es un por si acaso..
                CLEAR(lrArtTlm);
                lrArtTlm.SETCURRENTKEY("No.Item");
                lrArtTlm.SETRANGE("No.Item", "No.");
                lrArtTlm.MODIFYALL(Capitulo, Capitulo);
            end;
        }
    }
    var //         GLSetupRead: Boolean;
        //         GLSetup: Record "General Ledger Setup";
        //         Text006: Label 'Prices including VAT cannot be calculated when %1 is %2.';
        //         VATPostingSetup: Record "VAT Posting Setup";
        ProdOrderLine: Record "Prod. Order Line";
    //     LOCAL PROCEDURE CalcVAT(): Decimal;
    //     BEGIN
    //         IF "Price Includes VAT" THEN BEGIN
    //             VATPostingSetup.GET("VAT Bus. Posting Gr. (Price)", "VAT Prod. Posting Group");
    //             CASE VATPostingSetup."VAT Calculation Type" OF
    //                 VATPostingSetup."VAT Calculation Type"::"Reverse Charge VAT":
    //                     VATPostingSetup."VAT+EC %" := 0;
    //                 VATPostingSetup."VAT Calculation Type"::"Sales Tax":
    //                     ERROR(
    //                       Text006,
    //                       VATPostingSetup.FIELDCAPTION("VAT Calculation Type"),
    //                       VATPostingSetup."VAT Calculation Type");
    //             END;
    //         END ELSE
    //             CLEAR(VATPostingSetup);
    //         EXIT(VATPostingSetup."VAT %" / 100);
    //     END;
    //     local procedure GetGLSetup()
    //     begin
    //         if not GLSetupRead then
    //             GLSetup.Get();
    //         GLSetupRead := true;
    //     end;
    //     PROCEDURE stockEmpresa(recProducto: Record Item; empresa: Integer): Decimal;
    //     VAR
    //         recMovProducto: Record 32;
    //         recAlmacen: Record 14;
    //         filtroAlmacen: Text[1024];
    //         recConfExist: Record 313;
    //     BEGIN
    //         //+$004
    //         recConfExist.FIND('-');
    //         recMovProducto.RESET;
    //         recMovProducto.SETCURRENTKEY("Item No.", "Variant Code", "Drop Shipment", "Location Code", "Posting Date");
    //         recMovProducto.SETRANGE(recMovProducto."Item No.", recProducto."No.");
    //         recMovProducto.SETFILTER(recMovProducto."Global Dimension 1 Code", recProducto.GETFILTER(recProducto."Global Dimension 1 Filter"));
    //         recMovProducto.SETFILTER(recMovProducto."Global Dimension 2 Code", recProducto.GETFILTER(recProducto."Global Dimension 2 Filter"));
    //         recMovProducto.SETFILTER(recMovProducto."Drop Shipment", recProducto.GETFILTER(recProducto."Drop Shipment Filter"));
    //         recMovProducto.SETFILTER(recMovProducto."Variant Code", recProducto.GETFILTER(recProducto."Variant Filter"));
    //         recMovProducto.SETFILTER(recMovProducto."Lot No.", recProducto.GETFILTER(recProducto."Lot No. Filter"));
    //         recMovProducto.SETFILTER(recMovProducto."Serial No.", recProducto.GETFILTER(recProducto."Serial No. Filter"));
    //         //buscamos filtro almacen
    //         recMovProducto.SETFILTER(recMovProducto."Drop Shipment", recProducto.GETFILTER(recProducto."Drop Shipment Filter"));
    //         recMovProducto.SETFILTER(recMovProducto."Drop Shipment", recProducto.GETFILTER(recProducto."Drop Shipment Filter"));
    //         recAlmacen.RESET;
    //         IF empresa = 1 THEN
    //             recAlmacen.SETRANGE(recAlmacen.Empresa, recConfExist."Empresa Stock Estel")
    //         ELSE
    //             recAlmacen.SETRANGE(recAlmacen.Empresa, recConfExist."Empresa Stock NouFred");
    //         IF NOT recAlmacen.FIND('-') THEN
    //             EXIT(0);
    //         REPEAT
    //             IF filtroAlmacen = '' THEN
    //                 filtroAlmacen := recAlmacen.Code
    //             ELSE
    //                 filtroAlmacen := filtroAlmacen + '|' + recAlmacen.Code;
    //         UNTIL recAlmacen.NEXT = 0;
    //         recMovProducto.SETFILTER(recMovProducto."Location Code", filtroAlmacen);
    //         recMovProducto.CALCSUMS(recMovProducto.Quantity);
    //         EXIT(recMovProducto.Quantity);
    //     END;
    LOCAL procedure ProdOrderExist(): Boolean;
    var
    begin
        ProdOrderLine.SETCURRENTKEY(Status, "Item No.");
        ProdOrderLine.SETFILTER(Status, '..%1', ProdOrderLine.Status::Released);
        ProdOrderLine.SETRANGE("Item No.", "No.");
        IF NOT ProdOrderLine.ISEMPTY THEN EXIT(TRUE);
        EXIT(FALSE);
    end;

    PROCEDURE PuedeBorrarse() OK: Boolean;
    VAR
        lrItemJnlLine: Record 83;
        lrItemLedgEntry: Record 32;
        lrRequisitionLine: Record 246;
        lrProdOrderComp: Record 5407;
        lrBOMComp: Record 90;
        lrPurchLine: Record 39;
        lrSalesLine: Record 37;
        lrTransLine: Record 5741;
        lrServInvLine: Record 5902;
        lrProdBOMLine: Record 99000772;
        lrServiceContractLine: Record 5964;
        lrJobLedEntry: Record 169;
        lrJobJLine: Record 210;
        ProdBOMHeader: Record "Production BOM Header";
        ProdBOMLine: Record "Production BOM Line";
    BEGIN
        //+$004
        // PRYTO-2016/159 JPT 23/06/16
        // Devuelve true si el art¡culo puede borrarse
        OK := TRUE; // Por defecto
        CLEAR(lrItemLedgEntry);
        lrItemLedgEntry.SETCURRENTKEY("Item No.");
        lrItemLedgEntry.SETRANGE("Item No.", "No.");
        IF NOT lrItemLedgEntry.ISEMPTY THEN EXIT(FALSE);
        CLEAR(lrJobLedEntry);
        lrJobLedEntry.SETCURRENTKEY("Entry Type", Type, "No.", "Posting Date");
        lrJobLedEntry.SETRANGE(Type, lrJobLedEntry.Type::Item);
        lrJobLedEntry.SETRANGE("No.", "No.");
        IF NOT lrJobLedEntry.ISEMPTY THEN EXIT(FALSE);
        CLEAR(lrPurchLine);
        lrPurchLine.SETCURRENTKEY(Type, "No.");
        lrPurchLine.SETRANGE(Type, lrPurchLine.Type::Item);
        lrPurchLine.SETRANGE("No.", "No.");
        IF NOT lrPurchLine.ISEMPTY THEN EXIT(FALSE);
        CLEAR(lrSalesLine);
        lrSalesLine.SETCURRENTKEY(Type, "No.");
        lrSalesLine.SETRANGE(Type, lrSalesLine.Type::Item);
        lrSalesLine.SETRANGE("No.", "No.");
        IF NOT lrSalesLine.ISEMPTY THEN EXIT(FALSE);
        CLEAR(lrItemJnlLine);
        lrItemJnlLine.SETRANGE("Item No.", "No.");
        IF NOT lrItemJnlLine.ISEMPTY THEN EXIT(FALSE);
        CLEAR(lrJobJLine);
        lrJobJLine.SETRANGE(Type, lrJobJLine.Type::Item);
        lrJobJLine.SETRANGE("No.", "No.");
        IF NOT lrJobJLine.ISEMPTY THEN EXIT(FALSE);
        CLEAR(lrBOMComp);
        lrBOMComp.SETCURRENTKEY(Type, "No.");
        lrBOMComp.SETRANGE(Type, lrBOMComp.Type::Item);
        lrBOMComp.SETRANGE("No.", "No.");
        IF NOT lrBOMComp.ISEMPTY THEN EXIT(FALSE);
        CLEAR(lrRequisitionLine);
        lrRequisitionLine.SETCURRENTKEY(Type, "No.");
        lrRequisitionLine.SETRANGE(Type, lrRequisitionLine.Type::Item);
        lrRequisitionLine.SETRANGE("No.", "No.");
        IF NOT lrRequisitionLine.ISEMPTY THEN EXIT(FALSE);
        IF ProdOrderExist() THEN EXIT(FALSE);
        CLEAR(lrProdOrderComp);
        lrProdOrderComp.SETCURRENTKEY(Status, "Item No.");
        lrProdOrderComp.SETFILTER(Status, '..%1', lrProdOrderComp.Status::Released);
        lrProdOrderComp.SETRANGE("Item No.", "No.");
        IF NOT lrProdOrderComp.ISEMPTY THEN EXIT(FALSE);
        CLEAR(lrTransLine);
        lrTransLine.SETCURRENTKEY("Item No.");
        lrTransLine.SETRANGE("Item No.", "No.");
        IF NOT lrTransLine.ISEMPTY THEN EXIT(FALSE);
        CLEAR(lrServInvLine);
        lrServInvLine.SETCURRENTKEY(Type, "No.");
        lrServInvLine.SETRANGE(Type, lrServInvLine.Type::Item);
        lrServInvLine.SETRANGE("No.", "No.");
        IF NOT lrServInvLine.ISEMPTY THEN EXIT(FALSE);
        CLEAR(lrProdBOMLine);
        lrProdBOMLine.SETCURRENTKEY(Type, "No.");
        lrProdBOMLine.SETRANGE(Type, lrProdBOMLine.Type::Item);
        lrProdBOMLine.SETRANGE("No.", "No.");
        IF lrProdBOMLine.FINDSET() THEN
            REPEAT
                IF ProdBOMHeader.GET(ProdBOMLine."Production BOM No.") AND (ProdBOMHeader.Status = ProdBOMHeader.Status::Certified) THEN EXIT(FALSE);
            UNTIL lrProdBOMLine.NEXT() = 0;
        CLEAR(lrServiceContractLine);
        lrServiceContractLine.SETRANGE("Item No.", "No.");
        IF NOT lrServiceContractLine.ISEMPTY THEN EXIT(FALSE);
        //ServLedgEntry.RESET;
        //ServLedgEntry.SETRANGE("Item No. (Serviced)", "No.");
        //IF NOT ServLedgEntry.ISEMPTY  THEN
        //  EXIT(FALSE);
    END;
    //     PROCEDURE ShowTasaProducto();
    //     VAR
    //         lrRelTP: Record "Relacion Tasa Producto";
    //     BEGIN
    //         //+$004
    //         // ShowTasaProducto
    //         // $003 JPT 29/09/16 Nueva funci¢n "ShowTasaProducto". Muestra las lineas de tasa relacioandas con el producto
    //         lrRelTP.ShowTasaProducto("No.");
    //     END;
}
