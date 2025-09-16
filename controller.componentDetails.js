const { 
  getComponentByMappingId,
  updateComponentDetails,
  createNewComponentVersion,
  getComponentVersion,
  updateComponentMapping,
  createNewComponentMapping,
  deleteOldFiles,
  insertComponentFiles
} = require('../models/model.componentDetails');

// Import the working audit log function
const { insertComponentAuditLog } = require('../models/model.addComponentAuditLog');

const { uploadSingleFile } = require('../utils/azureBlobStorage');
const { formatForAPI } = require('../utils/dateFormatter');

/**
 * Safely extract value from multipart form field
 */
function safeExtractFieldValue(fieldValue) {
  if (!fieldValue) return null;
  
  if (typeof fieldValue === 'string' || typeof fieldValue === 'number') {
    return fieldValue;
  }
  
  if (typeof fieldValue === 'object') {
    try {
      // Handle different multipart field structures
      if (fieldValue.value !== undefined) return fieldValue.value;
      if (fieldValue.data !== undefined) return fieldValue.data;
      if (fieldValue.fields && Array.isArray(fieldValue.fields) && fieldValue.fields.length > 0) {
        return fieldValue.fields[0].value;
      }
      
      // Handle Fastify multipart field structure
      if (fieldValue.fieldname && fieldValue.value !== undefined) {
        return fieldValue.value;
      }
      
      // Handle array of values (take first one)
      if (Array.isArray(fieldValue) && fieldValue.length > 0) {
        return safeExtractFieldValue(fieldValue[0]);
      }
      
      // If it's an object but we can't extract a value, return null
      try {
        console.log(`⚠️  Could not extract value from field object:`, JSON.stringify(fieldValue, null, 2));
      } catch (jsonError) {
        console.log(`⚠️  Could not extract value from field object: [Circular reference - cannot stringify]`);
        console.log(`⚠️  Field object keys:`, Object.keys(fieldValue));
      }
      return null;
    } catch (error) {
      console.log(`❌ Error extracting field value:`, error.message);
      return null;
    }
  }
  
  return fieldValue;
}

/**
 * Convert field value to appropriate database type
 */
function convertToDatabaseType(fieldName, value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  const stringValue = value.toString().trim();
  
  switch (fieldName) {
    case 'componentType':
    case 'componentUnitOfMeasure':
    case 'componentBaseUnitOfMeasure':
    case 'componentPackagingType':
    case 'componentWeightUnitOfMeasure':
    case 'componentPackagingLevel':
    case 'packagingLevel':
      // Store as text values instead of converting to integer
      return stringValue;
      
    case 'componentQuantity':
    case 'componentBaseQuantity':
    case 'componentUnitWeight':
    case 'wW':
    case 'percentPostConsumer':
    case 'percentPostIndustrial':
    case 'percentChemical':
    case 'percentBioSourced':
      return parseFloat(stringValue) || null;
      
    case 'validityFrom':
    case 'validityTo':
      if (stringValue === '') return null;
      const dateValue = new Date(stringValue);
      return isNaN(dateValue.getTime()) ? null : dateValue;
      
    default:
      return stringValue === '' ? null : stringValue;
  }
}

/**
 * Controller for PUT /component-details/:mapping_id
 * Handles both UPDATE and REPLACE actions with FormData
 */
async function updateComponentDetailsController(request, reply) {
  try {
    const { mapping_id } = request.params;
    console.log(`🔄 Processing component details update for mapping ID: ${mapping_id}`);
    
    // Handle multipart/form-data
    let componentData = {};
    let fileData = {};
    
    // Extract boundary from content-type header
    const contentType = request.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=([^;]+)/);
    const boundary = boundaryMatch ? boundaryMatch[1] : null;
    
    console.log(`📋 Content-Type: ${contentType}`);
    console.log(`🔗 Boundary: ${boundary || 'Not found'}`);
    
    if (contentType.includes('multipart/form-data')) {
      // Validate boundary for EIP platforms
      if (!boundary) {
        console.error('❌ Missing boundary in multipart/form-data request');
        return reply.code(400).send({
          success: false,
          message: 'Missing boundary parameter in multipart/form-data request. Please ensure Content-Type includes boundary.',
          error: 'MISSING_BOUNDARY',
          expectedFormat: 'multipart/form-data; boundary=----WebKitFormBoundary...'
        });
      }
      
      if (request.body) {
        console.log(`📊 Form fields received: ${Object.keys(request.body).length}`);
        
        // Process form fields
        for (const key of Object.keys(request.body)) {
          const fieldValue = request.body[key];
          
          // Extract the actual value first
          const extractedValue = safeExtractFieldValue(fieldValue);
          
          // Log key fields with detailed structure
          if (key === 'action' || key === 'componentCode' || key === 'componentDescription') {
            console.log(`📝 ${key}: ${extractedValue}`);
            console.log(`📝 ${key} type: ${typeof fieldValue}`);
            
            // Safe JSON stringify to avoid circular reference errors
            try {
              const safeStructure = JSON.stringify(fieldValue, (key, value) => {
                if (key === 'fields' && Array.isArray(value)) {
                  return value.map(field => ({
                    fieldname: field.fieldname,
                    value: field.value,
                    type: typeof field.value
                  }));
                }
                return value;
              }, 2);
              console.log(`📝 ${key} structure:`, safeStructure);
            } catch (jsonError) {
              console.log(`📝 ${key} structure: [Circular reference - cannot stringify]`);
            }
          }
          
          // Handle file fields
          if (key === 'packagingEvidence' || key === 'evidenceChemicalRecycled') {
            if (fieldValue && typeof fieldValue === 'object') {
              if (fieldValue.filename || fieldValue.name) {
                // Single file
                const fileInfo = {
                  fieldName: key,
                  filename: fieldValue.filename || fieldValue.name || 'unknown',
                  mimetype: fieldValue.mimetype || fieldValue.type || 'application/octet-stream',
                  size: fieldValue._buf ? fieldValue._buf.length : (fieldValue.size || 0),
                  buffer: fieldValue._buf || fieldValue.buffer || fieldValue.data || null,
                  originalName: fieldValue.originalname || fieldValue.filename || fieldValue.name
                };
                
                // Get buffer if needed
                if (!fileInfo.buffer || !Buffer.isBuffer(fileInfo.buffer)) {
                  if (fieldValue.toBuffer && typeof fieldValue.toBuffer === 'function') {
                    try {
                      fileInfo.buffer = await fieldValue.toBuffer();
                      fileInfo.size = fileInfo.buffer ? fileInfo.buffer.length : 0;
                    } catch (bufferError) {
                      console.log(`❌ Failed to get buffer: ${bufferError.message}`);
                    }
                  }
                }
                
                fileData[key] = [fileInfo];
                console.log(`📁 File: ${fileInfo.filename} (${fileInfo.size} bytes)`);
                
              } else if (fieldValue.fields && Array.isArray(fieldValue.fields)) {
                // Multiple files
                const files = [];
                for (let i = 0; i < fieldValue.fields.length; i++) {
                  const file = fieldValue.fields[i];
                  if (file && (file.filename || file.name)) {
                    const fileInfo = {
                      fieldName: key,
                      filename: file.filename || file.name || `file_${i}`,
                      mimetype: file.mimetype || file.type || 'application/octet-stream',
                      size: file._buf ? file._buf.length : (file.size || 0),
                      buffer: file._buf || file.buffer || file.data || null,
                      originalName: file.originalname || file.filename || file.name
                    };
                    
                    if (!fileInfo.buffer || !Buffer.isBuffer(fileInfo.buffer)) {
                      if (file.toBuffer && typeof file.toBuffer === 'function') {
                        try {
                          fileInfo.buffer = await file.toBuffer();
                          fileInfo.size = fileInfo.buffer ? fileInfo.buffer.length : 0;
                        } catch (bufferError) {
                          console.log(`❌ Failed to get buffer for ${fileInfo.filename}: ${bufferError.message}`);
                        }
                      }
                    }
                    
                    files.push(fileInfo);
                  }
                }
                
                if (files.length > 0) {
                  fileData[key] = files;
                  console.log(`📁 Multiple files: ${files.length} files for ${key}`);
                }
              }
            }
          } else {
            // Regular form field - use the already extracted value
            const dbValue = convertToDatabaseType(key, extractedValue);
            componentData[key] = dbValue;
          }
        }
        
        console.log(`📁 Files to process: ${Object.keys(fileData).length} categories`);
        
        // Log the processed component data (safe JSON stringify)
        try {
          console.log('📊 Processed component data from UI:', JSON.stringify(componentData, null, 2));
        } catch (jsonError) {
          console.log('📊 Processed component data from UI: [Circular reference - cannot stringify]');
          console.log('📊 Component data keys:', Object.keys(componentData));
        }
        console.log('🔍 CM Code from UI:', componentData.cm_code);
      }
    } else {
      return reply.code(400).send({
        success: false,
        message: 'Content-Type must be multipart/form-data'
      });
    }
    
    // Validate required fields
    const requiredFields = ['action', 'componentCode', 'componentDescription', 'validityFrom', 'validityTo'];
    const missingFields = requiredFields.filter(field => !componentData[field]);
    
    if (missingFields.length > 0) {
      return reply.code(400).send({
        success: false,
        message: 'Missing required fields',
        missingFields: missingFields
      });
    }
    
    // Validate action
    if (!['UPDATE', 'REPLACE'].includes(componentData.action)) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid action. Must be UPDATE or REPLACE'
      });
    }
    
    // Get existing component data by mapping ID
    const existingComponent = await getComponentByMappingId(mapping_id);
    if (!existingComponent) {
      return reply.code(404).send({
        success: false,
        message: 'Component mapping not found'
      });
    }
    
    console.log(`🔍 Existing component found: ID ${existingComponent.component_id}, Version ${existingComponent.version}`);
    console.log(`🔍 Existing component cm_code: ${existingComponent.cm_code}`);
    console.log(`🔍 UI componentData cm_code: ${componentData.cm_code}`);
    
    let result;
    let filesUploaded = 0;
    
    if (componentData.action === 'UPDATE') {
      // Option 1: UPDATE existing component
      console.log('📝 Updating existing component...');
      
      // Map form fields to database columns
      const updateData = {
        id: existingComponent.id,
        material_type_id: componentData.componentType,
        component_code: componentData.componentCode,
        component_description: componentData.componentDescription,
        component_material_group: componentData.componentCategory,
        component_quantity: componentData.componentQuantity,
        component_uom_id: componentData.componentUnitOfMeasure,
        component_base_quantity: componentData.componentBaseQuantity,
        component_base_uom_id: componentData.componentBaseUnitOfMeasure,
        percent_w_w: componentData.wW,
        component_packaging_type_id: componentData.componentPackagingType,
        component_packaging_material: componentData.componentPackagingMaterial,
        component_unit_weight: componentData.componentUnitWeight,
        weight_unit_measure_id: componentData.componentWeightUnitOfMeasure,
        percent_mechanical_pcr_content: componentData.percentPostConsumer,
        percent_mechanical_pir_content: componentData.percentPostIndustrial,
        percent_chemical_recycled_content: componentData.percentChemical,
        percent_bio_sourced: componentData.percentBioSourced,
        material_structure_multimaterials: componentData.materialStructure,
        component_packaging_color_opacity: componentData.packagingColour,
        component_packaging_level_id: componentData.packagingLevel,
        component_dimensions: componentData.componentDimensions,
        componentvaliditydatefrom: componentData.validityFrom,
        componentvaliditydateto: componentData.validityTo,
        helper_column: componentData.chPack,
        evidence: componentData.kpisEvidenceMapping
      };
      
      // Update component details
      try {
        console.log('📝 Update data being sent to database:', JSON.stringify(updateData, null, 2));
      } catch (jsonError) {
        console.log('📝 Update data being sent to database: [Circular reference - cannot stringify]');
        console.log('📝 Update data keys:', Object.keys(updateData));
      }
      result = await updateComponentDetails(updateData);
      console.log('✅ Component update result:', result);
      
      // Handle file uploads
      if (Object.keys(fileData).length > 0) {
        // Delete old files first
        await deleteOldFiles(existingComponent.id);
        
        // Upload new files
        for (const [fieldName, files] of Object.entries(fileData)) {
          if (Array.isArray(files)) {
            for (const file of files) {
              if (file.buffer) {
                console.log(`🚀 Uploading file: ${file.filename}`);
                
                const uploadResult = await uploadSingleFile(
                  file.buffer,
                  file.filename,
                  file.mimetype,
                  existingComponent.cm_code,
                  existingComponent.sku_code,
                  existingComponent.component_code,
                  existingComponent.year || existingComponent.periods,
                  fieldName === 'packagingEvidence' ? 'packagingType' : 'evidence'
                );
                
                if (uploadResult.success) {
                  console.log(`✅ File uploaded: ${uploadResult.blobUrl}`);
                  
                  // Insert file record
                  await insertComponentFiles({
                    component_id: existingComponent.id,
                    file_name: file.filename,
                    file_url: uploadResult.blobUrl,
                    file_type: fieldName,
                    created_by: componentData.created_by || '1'
                  });
                  
                  filesUploaded++;
                } else {
                  console.error(`❌ File upload failed: ${uploadResult.error}`);
                }
              }
            }
          }
        }
      }
      
      // Insert audit log
      await insertComponentAuditLog({
        component_id: existingComponent.id,
        sku_code: existingComponent.sku_code,
        component_code: existingComponent.component_code,
        component_description: existingComponent.component_description,
        version: existingComponent.version,
        component_quantity: existingComponent.component_quantity,
        component_base_quantity: existingComponent.component_base_quantity,
        component_unit_weight: existingComponent.component_unit_weight,
        percent_w_w: existingComponent.percent_w_w,
        percent_mechanical_pcr_content: existingComponent.percent_mechanical_pcr_content,
        percent_mechanical_pir_content: existingComponent.percent_mechanical_pir_content,
        percent_chemical_recycled_content: existingComponent.percent_chemical_recycled_content,
        percent_bio_sourced: existingComponent.percent_bio_sourced,
        component_valid_from: existingComponent.component_valid_from,
        component_valid_to: existingComponent.component_valid_to,
        is_active: existingComponent.is_active,
        cm_code: componentData.cm_code || existingComponent.cm_code || 'DEFAULT_CM_CODE', // Use UI cm_code if provided, otherwise existing, otherwise default
        year: existingComponent.year,
        periods: existingComponent.periods,
        created_by: componentData.created_by || '1',
        created_date: new Date(),
        last_update_date: new Date(),
        helper_column: `UPDATE_ACTION: component_updated_${new Date().toISOString()}`
      });
      
    } else {
      // Option 2: REPLACE - Create new version
      console.log('🆕 Creating new component version...');
      
      // Get current version and increment
      const currentVersion = await getComponentVersion(existingComponent.component_code);
      const newVersion = currentVersion + 1;
      
      console.log(`📈 Current version: ${currentVersion}, New version: ${newVersion}`);
      
      // Create new component entry
      const newComponentData = {
        sku_code: existingComponent.sku_code,
        formulation_reference: existingComponent.formulation_reference,
        material_type_id: componentData.componentType,
        components_reference: existingComponent.components_reference,
        component_code: componentData.componentCode,
        component_description: componentData.componentDescription,
        version: newVersion,
        componentvaliditydatefrom: componentData.validityFrom,
        componentvaliditydateto: componentData.validityTo,
        component_material_group: componentData.componentCategory,
        component_quantity: componentData.componentQuantity,
        component_uom_id: componentData.componentUnitOfMeasure,
        component_base_quantity: componentData.componentBaseQuantity,
        component_base_uom_id: componentData.componentBaseUnitOfMeasure,
        percent_w_w: componentData.wW,
        evidence: componentData.kpisEvidenceMapping,
        component_packaging_type_id: componentData.componentPackagingType,
        component_packaging_material: componentData.componentPackagingMaterial,
        helper_column: componentData.chPack,
        component_unit_weight: componentData.componentUnitWeight,
        weight_unit_measure_id: componentData.componentWeightUnitOfMeasure,
        percent_mechanical_pcr_content: componentData.percentPostConsumer,
        percent_mechanical_pir_content: componentData.percentPostIndustrial,
        percent_chemical_recycled_content: componentData.percentChemical,
        percent_bio_sourced: componentData.percentBioSourced,
        material_structure_multimaterials: componentData.materialStructure,
        component_packaging_color_opacity: componentData.packagingColour,
        component_packaging_level_id: componentData.packagingLevel,
        component_dimensions: componentData.componentDimensions,
        packaging_specification_evidence: componentData.kpisEvidenceMapping,
        evidence_of_recycled_or_bio_source: componentData.kpisEvidenceMapping,
        last_update_date: new Date(),
        category_entry_id: existingComponent.category_entry_id,
        data_verification_entry_id: existingComponent.data_verification_entry_id,
        user_id: existingComponent.user_id,
        signed_off_by: existingComponent.signed_off_by,
        signed_off_date: existingComponent.signed_off_date,
        mandatory_fields_completion_status: existingComponent.mandatory_fields_completion_status,
        evidence_provided: existingComponent.evidence_provided,
        document_status: existingComponent.document_status,
        is_active: true,
        created_by: componentData.created_by || existingComponent.created_by,
        created_date: new Date(),
        year: existingComponent.year,
        component_unit_weight_id: existingComponent.component_unit_weight_id,
        cm_code: existingComponent.cm_code,
        periods: existingComponent.periods
      };
      
      result = await createNewComponentVersion(newComponentData);
      
      // Create NEW mapping entry with same version (don't update existing)
      // The old mapping stays unchanged, new mapping points to new component
      console.log(`🆕 Creating new mapping entry for component version ${newVersion}`);
      
      // Create new mapping entry with same version as the new component
      const newMappingData = {
        cm_code: existingComponent.cm_code,
        sku_code: existingComponent.sku_code,
        component_code: componentData.componentCode,
        version: newVersion,
        component_packaging_type_id: componentData.componentPackagingType,
        period_id: existingComponent.period_id,
        component_valid_from: componentData.validityFrom,
        component_valid_to: componentData.validityTo,
        created_by: componentData.created_by || existingComponent.created_by,
        is_active: true,
        componentvaliditydatefrom: componentData.validityFrom,
        componentvaliditydateto: componentData.validityTo
      };
      
      const newMapping = await createNewComponentMapping(newMappingData);
      console.log(`✅ New mapping entry created with ID: ${newMapping.id}`);
      
      // Note: We don't update the existing mapping, we create a new one
      // The old mapping will still point to the old component version
      
      // Handle file uploads for new component
      if (Object.keys(fileData).length > 0) {
        for (const [fieldName, files] of Object.entries(fileData)) {
          if (Array.isArray(files)) {
            for (const file of files) {
              if (file.buffer) {
                console.log(`🚀 Uploading file: ${file.filename}`);
                
                const uploadResult = await uploadSingleFile(
                  file.buffer,
                  file.filename,
                  file.mimetype,
                  existingComponent.cm_code,
                  existingComponent.sku_code,
                  result.component_code,
                  existingComponent.year || existingComponent.periods,
                  fieldName === 'packagingEvidence' ? 'packagingType' : 'evidence'
                );
                
                if (uploadResult.success) {
                  console.log(`✅ File uploaded: ${uploadResult.blobUrl}`);
                  
                  // Insert file record
                  await insertComponentFiles({
                    component_id: result.id,
                    file_name: file.filename,
                    file_url: uploadResult.blobUrl,
                    file_type: fieldName,
                    created_by: componentData.created_by || '1'
                  });
                  
                  filesUploaded++;
                } else {
                  console.error(`❌ File upload failed: ${uploadResult.error}`);
                }
              }
            }
          }
        }
      }
      
      // Insert audit log
      await insertComponentAuditLog({
        component_id: result.id,
        sku_code: result.sku_code,
        component_code: result.component_code,
        component_description: result.component_description,
        version: newVersion,
        component_quantity: result.component_quantity,
        component_base_quantity: result.component_base_quantity,
        component_unit_weight: result.component_unit_weight,
        percent_w_w: result.percent_w_w,
        percent_mechanical_pcr_content: result.percent_mechanical_pcr_content,
        percent_mechanical_pir_content: result.percent_mechanical_pir_content,
        percent_chemical_recycled_content: result.percent_chemical_recycled_content,
        percent_bio_sourced: result.percent_bio_sourced,
        component_valid_from: result.component_valid_from,
        component_valid_to: result.component_valid_to,
        is_active: result.is_active,
        cm_code: componentData.cm_code || result.cm_code || 'DEFAULT_CM_CODE', // Use UI cm_code if provided, otherwise result, otherwise default
        year: result.year,
        periods: result.periods,
        created_by: componentData.created_by || '1',
        created_date: new Date(),
        last_update_date: new Date(),
        helper_column: `REPLACE_ACTION: component_replaced_${new Date().toISOString()}_old_version_${existingComponent.version}`
      });
    }
    
    // Success response
    const responseData = {
      success: true,
      message: componentData.action === 'UPDATE' ? 'Component updated successfully' : 'Component replaced successfully',
      data: {
        component_id: result.id || existingComponent.id,
        version: result.version || existingComponent.version,
        action: componentData.action,
        files_uploaded: filesUploaded
      }
    };
    
    console.log(`✅ Component ${componentData.action.toLowerCase()}d successfully`);
    return reply.code(200).send(responseData);
    
  } catch (error) {
    console.error('❌ Error in updateComponentDetailsController:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Failed to update component details',
      error: error.message
    });
  }
}

module.exports = { updateComponentDetailsController };
