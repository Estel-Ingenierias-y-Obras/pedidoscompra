pageextension 58000 "Item Card" extends "Item Card"
{
    layout
    {
        addafter(Item)
        {
            group(Telematel)
            {
                group(Campos)
                {
                    ShowCaption = false;

                    field("Id Marca TLM"; Rec."Id Marca TLM")
                    {
                        ApplicationArea = All;
                        ToolTip = 'Specifies the value of the Id Marca TLM field.';
                    }
                    field("Marca TLM"; Rec."Marca TLM")
                    {
                        ApplicationArea = All;
                        ToolTip = 'Specifies the value of the Marca TLM field.';
                    }
                    field("Id Articulo TLM"; Rec."Id Articulo TLM")
                    {
                        ApplicationArea = All;
                        ToolTip = 'Specifies the value of the Id Articulo TLM field.';
                    }
                    field("Referencia TLM"; Rec."Referencia TLM")
                    {
                        ApplicationArea = All;
                        ToolTip = 'Specifies the value of the Referencia TLM field.';
                    }
                    field("Unit List Price"; Rec."Unit List Price")
                    {
                        ApplicationArea = All;
                        CaptionML = ENU = 'Unit List Price', ESP = 'Precio referencia (PVP)';
                        Editable = false;
                        ToolTip = 'Specifies the value of the Unit List Price field.';
                    }
                    field(Capitulo; Rec.Capitulo)
                    {
                        ApplicationArea = All;
                        ToolTip = 'Specifies the value of the Capítulo field.';
                    }
                }
                part("Clasificacion Articulos Subf."; "Clasificacion Articulos Subf.")
                {
                    ApplicationArea = All;
                    CaptionML = ESP = 'Clasificación Articulos';
                    SubPageLink = "Id Articulo" = FIELD("Id Articulo TLM");
                }
            }
        }
    }
    actions
    {
        addlast(processing)
        {
            group(Telematelactions)
            {
                Caption = 'Telematel';

                action("Actualizar Precio Referencia")
                {
                    ApplicationArea = All;
                    Enabled = Rec."Id Articulo TLM" <> 0;
                    Image = PriceAdjustment;
                    ToolTip = 'Executes the Actualizar Precio Referencia action.';

                    trigger OnAction()
                    var
                        cGestGoCat: Codeunit GestGoCatalog;
                    begin
                        IF cGestGoCat.UpdateItemPrice(Rec) THEN Rec.MODIFY(TRUE);
                    end;
                }
                action("Precios Telematel")
                {
                    ApplicationArea = All;
                    ShortCutKey = 'Ctrl+P';
                    CaptionML = ESP = 'Precios Telematel';
                    Promoted = true;
                    Enabled = Rec."Id Articulo TLM" <> 0;
                    PromotedIsBig = true;
                    Image = Price;
                    PromotedCategory = Category7;
                    ToolTip = 'Executes the Precios Telematel action.';

                    trigger OnAction()
                    var
                        lrPrec: Record "Telematel Precios Articulo";
                    begin
                        IF Rec."Id Articulo TLM" <> 0 THEN BEGIN
                            CLEAR(lrPrec);
                            lrPrec.SETCURRENTKEY(IdArticulo);
                            lrPrec.SETRANGE(IdArticulo, Rec."Id Articulo TLM");
                            PAGE.RUN(0, lrPrec);
                        END;
                    end;
                }
                action("Descuentos Telematel")
                {
                    ApplicationArea = All;
                    CaptionML = ESP = 'Descuentos Telematel', ESM = 'Descuentos';
                    RunObject = Page "Telematel Descuentos";
                    RunPageView = SORTING("Id Marca", "Tipo Descuento") WHERE("Tipo Descuento" = CONST(Articulo));
                    RunPageLink = "Id Marca" = FIELD("Id Marca TLM"), "Id Dto" = FIELD("Id Articulo TLM");
                    Promoted = true;
                    Visible = FALSE;
                    Enabled = Rec."Id Articulo TLM" <> 0;
                    PromotedIsBig = true;
                    Image = Discount;
                    PromotedCategory = Category7;
                    ToolTip = 'Executes the Descuentos Telematel action.';
                }
            }
        }
    }
}
