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
        page "EST Purchase Ship-to API" = X,
        page "EST Purchase Company API" = X,
        page "EST Purchase Countries API" = X,
        tabledata "Country/Region" = R,
        page "EST Purchase Contacts API" = X,
        page "EST Purchase Vendor Links API" = X,
        page "EST Purchase Pay Vendors API" = X,
        page "EST Purchase Project Address" = X,
        tabledata Job = R,
        tabledata Contact = R,
        tabledata "Contact Business Relation" = R,
        tabledata Vendor = R,
        tabledata "Ship-to Address" = R,
        tabledata "Company Information" = R,
        tabledata Location = R,
        tabledata Customer = R,
        tabledata "User Setup" = R,
        tabledata "Job Task" = R,
        codeunit "Release Purchase Document" = X;
}
