import OSDAnnotationLayer from './OSDAnnotationLayer';

import { 
  WebAnnotation, 
  createEnvironment,
} from '@recogito/recogito-client-core';

import '@recogito/annotorious/src/ImageAnnotator.scss';
import '@recogito/recogito-client-core/themes/default';

export default (viewer, config) => {
    const env = createEnvironment();
    const annotationLayer = new OSDAnnotationLayer({viewer, env, config})

    // state variables
    let selectedAnnotation = null, selectedDOMElement = null

    const clearState = () => {
        selectedAnnotation = null
        selectedDOMElement = null
    }

    annotationLayer.on('select', (evt) => {
        const { annotation, element, skipEvent } = evt;
        if (annotation) {
            console.log('select')
            selectedAnnotation = annotation 
            selectedDOMElement = element 

            if (!annotation.isSelection && !skipEvent) {
                // TODO emit onZoneSelected
            }
        } else {
            clearState();
        }
    })

    annotationLayer.setZones = (annotations) => {
        const safe = annotations || []; // Allow null for cleaning all current annotations
        const webannotations = safe.map(a => new WebAnnotation(a));
        annotationLayer.init(webannotations.map(a => a.clone()));
        clearState();
    }

    annotationLayer.getZones = () => {
        // TODO
    }

    annotationLayer.save = () => {
        const anno = (selectedAnnotation instanceof WebAnnotation) ? selectedAnnotation.clone() : selectedAnnotation.toAnnotation()
        clearState();    
        annotationLayer.deselect();
        annotationLayer.addOrUpdateAnnotation(anno,selectedAnnotation);
    }

    annotationLayer.cancel = () => {
        clearState();    
        annotationLayer.deselect();
    }

    return annotationLayer
}