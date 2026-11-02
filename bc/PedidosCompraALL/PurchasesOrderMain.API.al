page 59110 "EST PurchHeader API"
{
    PageType = API;
    APIPublisher = 'estel';
    APIGroup = 'purchase';
    APIVersion = 'v1.0';
    EntityName = 'purchaseHeaderDetailed';
    EntitySetName = 'purchaseHeadersDetailed';
    SourceTable = "Purchase Header";
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
                field(number; Rec."No.") { }
                field(buyFromVendorNumber; Rec."Buy-from Vendor No.") { }
                field(documentDate; Rec."Document Date") { }
                field(amount; Rec.Amount) { }
                field(amountIncludingVAT; Rec."Amount Including VAT") { }
                field(documentType; Rec."Document Type") { }
                field(orderDate; Rec."Order Date") { }
                field(expectedReceiptDate; Rec."Expected Receipt Date") { }
                field(Estado; rec.Status) { }
                field(Proyecto; Rec.ALXProyecto) { }
                field(NombreCliente; Rec."Buy-from Vendor Name") { }


            }
        }
    }

    trigger OnAfterGetRecord()
    begin
        Rec.CalcFields(Amount, "Amount Including VAT");
    end;
}
