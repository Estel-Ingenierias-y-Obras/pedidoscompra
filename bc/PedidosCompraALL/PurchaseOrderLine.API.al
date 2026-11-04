page 59111 "EST PurchLine API"
{
    PageType = API;
    APIPublisher = 'estel';
    APIGroup = 'purchase';
    APIVersion = 'v1.0';
    EntityName = 'purchaseLine';
    EntitySetName = 'purchaseLine';
    SourceTable = "Purchase Line";
    DelayedInsert = true;
    ODataKeyFields = SystemId;
    SourceTableView = where("Document Type" = const(Order));

    layout
    {
        area(content)
        {
            repeater(Group)
            {
                field(id; Rec.SystemId) { }
                field(lineNumber; Rec."Line No.") { }
                field(lineType; Rec.Type) { }
                field(unitOfMeasureCode; Rec."Unit of Measure Code") { }
                field(documentType; Rec."Document Type") { }
                field(orderDate; Rec."Order Date") { }
                field(expectedReceiptDate; Rec."Expected Receipt Date") { }
                field(Referencia; rec."No.") { }
                field(Proyecto; Rec."Job No.") { }
                field(PC; Rec."Document No.") { }
                field(Cantidad; Rec.Quantity) { }
                field(CantidadRecivida; Rec."Quantity Received") { }
                field(CantidadARecibir; Rec."Outstanding Quantity") { }
                field(Description; Rec.Description) { }
                field(unitCost; Rec."Direct Unit Cost") { Editable = false; }
                field(lineAmount; Rec."Line Amount") { Editable = false; }
                field(quantityInvoiced; Rec."Quantity Invoiced") { Editable = false; }


            }
        }
    }
}
