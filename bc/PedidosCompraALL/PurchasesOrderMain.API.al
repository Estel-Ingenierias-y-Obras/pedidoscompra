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
                field(taskNumber; Rec.ALXTarea) { Editable = false; }
                field(assignedUserId; Rec."Assigned User ID") { Editable = false; }
                field(currencyCode; Rec."Currency Code") { Editable = false; }
                field(shipToName; Rec."Ship-to Name") { Editable = false; }
                field(shipToAddress; Rec."Ship-to Address") { Editable = false; }
                field(shipToAddress2; Rec."Ship-to Address 2") { Editable = false; }
                field(shipToCity; Rec."Ship-to City") { Editable = false; }
                field(shipToPostCode; Rec."Ship-to Post Code") { Editable = false; }
                field(shipToCounty; Rec."Ship-to County") { Editable = false; }
                field(shipToCountry; Rec."Ship-to Country/Region Code") { Editable = false; }


            }
        }
    }

    trigger OnAfterGetRecord()
    begin
        Rec.CalcFields(Amount, "Amount Including VAT");
    end;
}
