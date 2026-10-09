
page 60700 "DiarioProductos"
{
    PageType = API;
    Caption = 'Diario de Productos';
    APIPublisher = 'Estel';
    APIGroup = 'GestionMaterial';
    APIVersion = 'v1.0';
    EntityName = 'diarioProducto';
    EntitySetName = 'diarioProductos';
    DelayedInsert = true;
    SourceTable = "Item Journal Line";
    ODataKeyFields = SystemId;
    Extensible = false;
    ModifyAllowed = false;
    DeleteAllowed = false;
    Permissions = tabledata "Item Journal Line" = RI;

    layout
    {
        area(Content)
        {
            repeater(Group)
            {
                field(id; Rec.SystemId) { Editable = false; }
                field(claveintegracion; IntegrationKey) { }
                field(fecharegistro; Rec."Posting Date") { Editable = false; }
                field(tipomovimiento; Rec."Entry Type") { Editable = false; }
                field(numdoc; Rec."Document No.") { Editable = false; }
                field(numprod; ItemNo) { }
                field(descripcion; Rec.Description) { Editable = false; }
                field(codalmacen; Rec."Location Code") { Editable = false; }
                field(cantidad; InputQuantity) { }
                field(codudmedida; UnitCode) { }
                field(preciounitario; UnitAmount)
                {
                    trigger OnValidate()
                    begin
                        SelectPriceMode(1);
                    end;
                }
                field(importe; InputAmount)
                {
                    trigger OnValidate()
                    begin
                        SelectPriceMode(2);
                    end;
                }
                field(importedto; Rec."Discount Amount") { Editable = false; }
                field(costeunitario; UnitCost)
                {
                    trigger OnValidate()
                    begin
                        SelectPriceMode(3);
                    end;
                }
                field(liqpornumorden; AppliesTo) { }
                field(tipoproyectocodigo; ProjectType) { }
                field(departamento; Rec."Shortcut Dimension 2 Code") { Editable = false; }
                field(cantidadbase; Rec."Quantity (Base)") { Editable = false; }
                field(factorunidad; Rec."Qty. per Unit of Measure") { Editable = false; }
                field(conjuntodimensiones; Rec."Dimension Set ID") { Editable = false; }
            }
        }

    }

    trigger OnOpenPage()
    begin
        Management.ScopeLines(Rec);
    end;

    trigger OnNewRecord(BelowxRec: Boolean)
    begin
        Clear(Input);
        Clear(IntegrationKey);
        PriceMode := 0;
        Clear(ItemNo);
        Clear(InputQuantity);
        Clear(UnitCode);
        Clear(UnitAmount);
        Clear(InputAmount);
        Clear(UnitCost);
        Clear(AppliesTo);
        ProjectType := 'INDIRECTO';
        Rec."Posting Date" := Today();
        Rec."Entry Type" := Rec."Entry Type"::"Positive Adjmt.";
        Rec."Location Code" := 'CENTRAL 3';
        Rec."Shortcut Dimension 2 Code" := 'SG-ALMACEN';
    end;

    trigger OnInsertRecord(BelowxRec: Boolean): Boolean
    begin
        // Capture primitives first: JSON property order must not run table triggers.
        Input."Item No." := ItemNo;
        Input.Quantity := InputQuantity;
        Input."Unit of Measure Code" := UnitCode;
        Input."Unit Amount" := UnitAmount;
        Input.Amount := InputAmount;
        Input."Unit Cost" := UnitCost;
        Input."Applies-to Entry" := AppliesTo;
        Input."Shortcut Dimension 1 Code" := ProjectType;
        Management.CreateEntry(Input, IntegrationKey, PriceMode, Rec);
        LoadResponse();
        // Inserted by the codeunit, or an existing line returned for a retry.
        exit(false);
    end;

    trigger OnAfterGetRecord()
    begin
        LoadResponse();
    end;

    local procedure LoadResponse()
    begin
        ItemNo := Rec."Item No.";
        InputQuantity := Rec.Quantity;
        UnitCode := Rec."Unit of Measure Code";
        UnitAmount := Rec."Unit Amount";
        InputAmount := Rec.Amount;
        UnitCost := Rec."Unit Cost";
        AppliesTo := Rec."Applies-to Entry";
        ProjectType := Rec."Shortcut Dimension 1 Code";
        IntegrationKey := Rec."GM Integration Key";
    end;

    local procedure SelectPriceMode(NewMode: Integer)
    begin
        if (PriceMode <> 0) and (PriceMode <> NewMode) then
            Error('Envie solo uno de preciounitario, importe o costeunitario. BC calcula los demas.');
        PriceMode := NewMode;
    end;

    var
        Input: Record "Item Journal Line" temporary;
        Management: Codeunit "GM Entry Management";
        IntegrationKey: Guid;
        PriceMode: Integer;
        ItemNo: Code[20];
        InputQuantity: Decimal;
        UnitCode: Code[10];
        UnitAmount: Decimal;
        InputAmount: Decimal;
        UnitCost: Decimal;
        AppliesTo: Integer;
        ProjectType: Code[20];
}
