/** Product group columns for list/grid views — excludes heavy `image` blob. */
export const PRODUCT_GROUP_LIST_COLUMNS =
  'id,name,category,base_sku,fournisseur,min_stock,created_at,updated_at,company_id' as const;

/** Single group fetch including image (edit / detail). */
export const PRODUCT_GROUP_DETAIL_COLUMNS =
  `${PRODUCT_GROUP_LIST_COLUMNS},image` as const;

/** Product variant columns for tables — excludes `image`. */
export const PRODUCT_VARIANT_LIST_COLUMNS =
  'id,name,sku,category,fournisseur,size,color,quantity,price,remise,prix_ttc,min_stock,product_group_id,fiche_technique_url,created_at' as const;

/** Backup / export — omit image blobs (use Storage for files). */
export const PRODUCT_GROUP_EXPORT_COLUMNS = PRODUCT_GROUP_LIST_COLUMNS;

export const PRODUCT_EXPORT_COLUMNS =
  'id,name,sku,category,fournisseur,size,color,quantity,price,remise,prix_ttc,min_stock,product_group_id,fiche_technique_url,company_id,created_at' as const;
