import OSDAnnotationLayer from './OSDAnnotationLayer';
import EventEmitter from 'tiny-emitter';

import { 
  WebAnnotation, 
  createEnvironment,
} from '@recogito/recogito-client-core';

import '@recogito/annotorious/src/ImageAnnotator.scss';
import '@recogito/recogito-client-core/themes/default';

class ZoneLayer {

    constructor(viewer, config) {
        super();

        const env = createEnvironment();
        this.annotationLayer = new OSDAnnotationLayer({viewer, env, config})
    
        // state variables
        this.selectedAnnotation = null
        this.selectedDOMElement = null
        this.modifiedTarget = null

        this.annotationLayer.on('select', (evt) => {
            const { annotation, element, skipEvent } = evt;
            if (annotation) {
                console.log('select')
                this.selectedAnnotation = annotation 
                this.selectedDOMElement = element 
    
                if (!skipEvent) {
                    const anno = !this.selectedAnnotation.isSelection ? this.selectedAnnotation : this.selectedAnnotation.toAnnotation()
                    const zone = annotationToZone(anno)
                    this.emit('zoneSelected', zone);
                }
            } else {
                this.clearSelection();
            }
        })
    
        this.annotationLayer.on('updateTarget', (el, target) => {
            this.selectedDOMElement = el
            this.modifiedTarget = target
        })    
    }

    // Clear the current selection.
    clearSelection() {
        this.selectedAnnotation = null
        this.selectedDOMElement = null
        this.modifiedTarget = null
    }

    // Set the zones in this layer.
    setZones(zones) {
        const annotations = []
        for( const zone of zones ) {
            const anno = zoneToAnnotation(zone)
            annotations.push(new WebAnnotation(anno))
        }
        this.annotationLayer.init(annotations);
        this.clearSelection();
    }

    // Get the zones in this layer.
    getZones() {
        const annotations = this.annotationLayer.getAnnotations()
        const zones = []
        for( const annotation of annotations ) {
            const zone = annotationToZone(annotation.underlying)
            zones.push(zone)
        }
        return zones
    }

    // Save the currently selected zone, optionally overwriting its ID
    save(zoneID=null) {
        const previousAnno = !this.selectedAnnotation.isSelection ? this.selectedAnnotation : this.selectedAnnotation.toAnnotation()
        const nextAnno = (this.modifiedTarget) ? previousAnno.clone({ target: this.modifiedTarget }) : previousAnno.clone();
        if( zoneID ) nextAnno.underlying.id = zoneID
        this.clearSelection();    
        this.annotationLayer.deselect();
        this.annotationLayer.addOrUpdateAnnotation(nextAnno, previousAnno);
        const zone = annotationToZone(nextAnno.underlying)
        this.emit('zoneSaved', zone);
    }

    // Deselect the currently selected zone, undoing any changes to it.
    cancel() {
        this.clearSelection();    
        this.annotationLayer.deselect();
    }
}

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

export default (viewer, config) =>
  new ZoneLayer(viewer, config); 