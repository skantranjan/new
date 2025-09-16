const pool = require('../config/db.config');

/**
 * Get component details by CM code and SKU code using two-table approach
 * @param {string} cmCode - The CM code to search for
 * @param {string} skuCode - The SKU code to search for
 * @returns {Promise<Array>} Array of component details with mapping information
 */
async function getComponentBySkuReference(cmCode, skuCode) {
  // const query = `
  //   WITH component_mapping AS (
  //     SELECT 
  //       m.cm_code,
  //       m.sku_code,
  //       m.component_code,
  //       m.version as mapping_version,
  //       m.component_packaging_type_id,
  //       m.period_id,
  //       m.component_valid_from,
  //       m.component_valid_to
  //     FROM public.sdp_sku_component_mapping_details m
  //     WHERE m.cm_code = $1 
  //     AND m.sku_code = $2
  //   )
  //   SELECT 
  //     -- Mapping table data (including mapping table ID for toggle functionality)
  //     m.id as mapping_id,
  //     cm.cm_code,
  //     cm.sku_code,
  //     cm.component_code,
  //     cm.mapping_version,
  //     cm.component_packaging_type_id,
  //     cm.period_id,
  //     cm.component_valid_from,
  //     cm.component_valid_to,
      
  //     -- Component details data
  //     cd.id as component_id,
  //     cd.formulation_reference,
  //     cd.material_type_id,
  //     cd.components_reference,
  //     cd.component_description,
  //     cd.component_material_group,
  //     cd.component_quantity,
  //     cd.component_uom_id,
  //     cd.component_base_quantity,
  //     cd.component_base_uom_id,
  //     cd.percent_w_w,
  //     cd.evidence,
  //     cd.component_packaging_type_id as cd_component_packaging_type_id,
  //     cd.component_packaging_material,
  //     cd.helper_column,
  //     cd.component_unit_weight,
  //     cd.weight_unit_measure_id,
  //     cd.percent_mechanical_pcr_content,
  //     cd.percent_mechanical_pir_content,
  //     cd.percent_chemical_recycled_content,
  //     cd.percent_bio_sourced,
  //     cd.material_structure_multimaterials,
  //     cd.component_packaging_color_opacity,
  //     cd.component_packaging_level_id,
  //     cd.component_dimensions,
  //     cd.packaging_specification_evidence,
  //     cd.evidence_of_recycled_or_bio_source,
  //     cd.last_update_date,
  //     cd.category_entry_id,
  //     cd.data_verification_entry_id,
  //     cd.user_id,
  //     cd.signed_off_by,
  //     cd.signed_off_date,
  //     cd.mandatory_fields_completion_status,
  //     cd.evidence_provided,
  //     cd.document_status,
  //     cd.is_active,
  //     cd.created_by,
  //     cd.created_date,
  //     cd.year,
  //     cd.component_unit_weight_id,
  //     cd.periods,
  //     cd.componentvaliditydatefrom,
  //     cd.componentvaliditydateto
  //   FROM component_mapping cm
  //   INNER JOIN public.sdp_component_details cd 
  //     ON cm.component_code = cd.component_code 
  //     AND cd.is_active = true
  //   INNER JOIN public.sdp_sku_component_mapping_details m
  //     ON cm.cm_code = m.cm_code 
  //     AND cm.sku_code = m.sku_code 
  //     AND cm.component_code = m.component_code
  //   ORDER BY cm.component_code ASC, cm.mapping_version ASC;
  // `;
  
   const query = `
   WITH component_mapping AS (
  SELECT 
    m.cm_code,
    m.sku_code,
    m.component_code,
    m.version as mapping_version,
    m.component_packaging_type_id,
    m.period_id,
    m.component_valid_from,
    m.component_valid_to,
    m.id as mapping_id
  FROM public.sdp_sku_component_mapping_details m
  WHERE m.cm_code = $1
    AND m.sku_code = $2
),
component_details_ranked AS (
  SELECT *,
         ROW_NUMBER() OVER (PARTITION BY component_code ORDER BY last_update_date DESC) as rn
  FROM public.sdp_component_details
  WHERE is_active = true
),
component_details_deduped AS (
  SELECT * FROM component_details_ranked WHERE rn = 1
)
SELECT 
  cm.mapping_id,
  cm.cm_code,
  cm.sku_code,
  cm.component_code,
  cm.mapping_version,
  cm.component_packaging_type_id,
  cm.period_id,
  cm.component_valid_from,
  cm.component_valid_to,
  
  -- Component details
  cd.id as component_id,
  cd.formulation_reference,
  cd.material_type_id,
  cd.components_reference,
  cd.component_description,
  cd.component_material_group,
  cd.component_quantity,
  cd.component_uom_id,
  cd.component_base_quantity,
  cd.component_base_uom_id,
  cd.percent_w_w,
  cd.evidence,
  cd.component_packaging_type_id as cd_component_packaging_type_id,
  cd.component_packaging_material,
  cd.helper_column,
  cd.component_unit_weight,
  cd.weight_unit_measure_id,
  cd.percent_mechanical_pcr_content,
  cd.percent_mechanical_pir_content,
  cd.percent_chemical_recycled_content,
  cd.percent_bio_sourced,
  cd.material_structure_multimaterials,
  cd.component_packaging_color_opacity,
  cd.component_packaging_level_id,
  cd.component_dimensions,
  cd.packaging_specification_evidence,
  cd.evidence_of_recycled_or_bio_source,
  cd.last_update_date,
  cd.category_entry_id,
  cd.data_verification_entry_id,
  cd.user_id,
  cd.signed_off_by,
  cd.signed_off_date,
  cd.mandatory_fields_completion_status,
  cd.evidence_provided,
  cd.document_status,
  cd.is_active,
  cd.created_by,
  cd.created_date,
  cd.year,
  cd.component_unit_weight_id,
  cd.periods,
  cd.componentvaliditydatefrom,
  cd.componentvaliditydateto
FROM component_mapping cm
LEFT JOIN component_details_deduped cd 
  ON cm.component_code = cd.component_code
ORDER BY cm.component_code ASC, cm.mapping_version ASC;

  `;
  const result = await pool.query(query, [cmCode, skuCode]);
  return result.rows;
}

module.exports = {
  getComponentBySkuReference
}; 