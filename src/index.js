import OSDAnnotationLayer from './OSDAnnotationLayer';

import { 
  WebAnnotation, 
  createEnvironment,
} from '@recogito/recogito-client-core';

import '@recogito/annotorious/src/ImageAnnotator.scss';
import '@recogito/recogito-client-core/themes/default';


function annotationToZone(anno) {
    const posStr = anno.target.selector.value
    const coords = posStr.slice('xywh=pixel:'.length).split(',').map(s => parseFloat(s))
    return {
        id: anno.id,
        ulx: coords[0],
        uly: coords[1],
        lrx: coords[2] + coords[0],
        lty: coords[3] + coords[1]
    }
}

function zoneToAnnotation(zone) {
    return JSON.parse(`{ 
        "@context": "http://www.w3.org/ns/anno.jsonld",
        "id": "${zone.id}",
        "type": "Annotation",
        "body": [{
          "type": "TextualBody",
          "value": "XYZ"
        }],
        "target": {
          "selector": {
            "type": "FragmentSelector",
            "conformsTo": "http://www.w3.org/TR/media-frags/",
            "value": "xywh=pixel:${zone.ulx},${zone.uly},${zone.lrx-zone.ulx},${zone.lry-zone.uly}"
          }
        }
      }`)
}

export default (viewer, config) => {
    const env = createEnvironment();
    const annotationLayer = new OSDAnnotationLayer({viewer, env, config})

    // state variables
    let selectedAnnotation = null, selectedDOMElement = null, modifiedTarget = null

    const clearState = () => {
        selectedAnnotation = null
        selectedDOMElement = null
        modifiedTarget = null
    }

    annotationLayer.on('select', (evt) => {
        const { annotation, element, skipEvent } = evt;
        if (annotation) {
            console.log('select')
            selectedAnnotation = annotation 
            selectedDOMElement = element 

            if (!skipEvent) {
                const anno = !selectedAnnotation.isSelection ? selectedAnnotation : selectedAnnotation.toAnnotation()
                const zone = annotationToZone(anno)
                annotationLayer.emit('zoneSelected', zone);
            }
        } else {
            clearState();
        }
    })

    annotationLayer.on('updateTarget', (el, target) => {
        selectedDOMElement = el
        modifiedTarget = target
    })

    annotationLayer.setZones = (zones) => {
        const annotations = []
        for( const zone of zones ) {
            const anno = zoneToAnnotation(zone)
            annotations.push(new WebAnnotation(anno))
        }
        annotationLayer.init(annotations);
        clearState();
    }

    annotationLayer.getZones = () => {
        const annotations = annotationLayer.getAnnotations()
        const zones = []
        for( const annotation of annotations ) {
            const zone = annotationToZone(annotation.underlying)
            zones.push(zone)
        }
        return zones
    }

    annotationLayer.save = (zoneID) => {
        const previousAnno = !selectedAnnotation.isSelection ? selectedAnnotation : selectedAnnotation.toAnnotation()
        const nextAnno = (modifiedTarget) ? previousAnno.clone({ target: modifiedTarget }) : previousAnno.clone();
        nextAnno.underlying.id = zoneID
        clearState();    
        annotationLayer.deselect();
        annotationLayer.addOrUpdateAnnotation(nextAnno, previousAnno);
        const zone = annotationToZone(nextAnno.underlying)
        annotationLayer.emit('zoneSaved', zone);
    }

    annotationLayer.cancel = () => {
        clearState();    
        annotationLayer.deselect();
    }

    return annotationLayer
}