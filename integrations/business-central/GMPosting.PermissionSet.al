permissionset 60710 "GM REGISTRAR API"
{
    Assignable = true;
    Caption = 'Registrar entradas desde la web';
    IncludedPermissionSets = "GM ENTRADAS API";
    Permissions = page "GM Post Entry" = X,
                  codeunit "GM Post Management" = X,
                  codeunit "Item Jnl.-Post Line" = X,
                  codeunit "Item Jnl.-Check Line" = X,
                  tabledata "GM Entry Request" = rm,
                  tabledata "Item Journal Line" = rd,
                  tabledata Item = Rm,
                  tabledata "Item Ledger Entry" = Rimd,
                  tabledata "Item Register" = Rimd,
                  tabledata "Value Entry" = Rimd,
                  tabledata "Item Application Entry" = Rimd,
                  tabledata "Stockkeeping Unit" = Rimd,
                  tabledata "Avg. Cost Adjmt. Entry Point" = Rim,
                  tabledata "Post Value Entry to G/L" = Ri;
}
