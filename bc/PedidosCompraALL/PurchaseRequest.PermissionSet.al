permissionset 59112 "EST PURCHASE WEB"
{
    Assignable = true;
    Caption = 'Pedidos de compra web';
    Permissions = tabledata "EST Purchase Request" = RIM,
        table "EST Purchase Request" = X,
        page "EST Purchase Request API" = X,
        page "EST PurchHeader API" = X,
        page "EST PurchLine API" = X,
        page "EST Purchase Users API" = X,
        page "EST Purchase Tasks API" = X,
        tabledata "User Setup" = R,
        tabledata "Job Task" = R,
        codeunit "Release Purchase Document" = X;
}
