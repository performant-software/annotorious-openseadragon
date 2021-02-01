import OSDAnnotationLayer from './OSDAnnotationLayer';
import EventEmitter from 'tiny-emitter';

import { 
  WebAnnotation, 
  createEnvironment,
} from '@recogito/recogito-client-core';

import '@recogito/annotorious/src/ImageAnnotator.scss';
import '@recogito/recogito-client-core/themes/default';

class ZoneLayer extends EventEmitter {

    constructor(viewer, config) {
        super();

        // state variables
        this.selectedAnnotation = null
        this.selectedDOMElement = null
        this.modifiedTarget = null
        
        const env = createEnvironment();
        this._annotationLayer = new OSDAnnotationLayer({viewer, env, config})
        this._annotationLayer.on('select', this._onSelect)    
        this._annotationLayer.on('updateTarget', this._onUpdateTarget)    
    }

    _onUpdateTarget = (el, target) => {
        this.selectedDOMElement = el
        this.modifiedTarget = target
    }

    _onSelect = (evt) => {
        const { annotation, element, skipEvent } = evt;
        if (annotation) {
            this.selectedAnnotation = annotation 
            this.selectedDOMElement = element 

            if (!skipEvent) {
                let zone
                if( this.selectedAnnotation.isSelection ) {
                    const anno = this.selectedAnnotation.toAnnotation()
                    zone = annotationToZone(anno)
                    // zone in progress has ID of null
                    zone.id = null
                } else {
                    const anno = this.selectedAnnotation 
                    zone = annotationToZone(anno)
                }
                this.emit('zoneSelected', zone, this.selectedDOMElement);
            }
        } else {
            this.clearSelection();
        }
    }

    // Enable drawing
    setDrawingEnabled(enabled) {
        this._annotationLayer.setDrawingEnabled(enabled)
    }

    // Set drawing tool 'rect' or 'polygon'
    setDrawingTool(tool) {
        this._annotationLayer.setDrawingTool(tool)
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
        this._annotationLayer.init(annotations);
        this.clearSelection();
    }

    // Get the zones in this layer.
    getZones() {
        const annotations = this._annotationLayer.getAnnotations()
        const zones = []
        for( const annotation of annotations ) {
            const zone = annotationToZone(annotation.underlying)
            zones.push(zone)
        }
        return zones
    }

    removeSelectedZone() {
        const {annotation} = this._annotationLayer.selectedShape
        this._annotationLayer.removeAnnotation(annotation);
    }

    setHighlights(zoneIDs) {
        // iterate through all the shapes and highlight or unhighlight
        const g = this._annotationLayer.g
        const shapes = Array.from(g.querySelectorAll('.a9s-annotation'));
        for( const shape of shapes ) {
            const shapeID = shape.getAttribute('data-id')
            if( zoneIDs.includes(shapeID) ) {
                shape.classList.add('highlight')
            } else {
                shape.classList.remove('highlight')
            }
        }
    }

    // Save the currently selected annotation, optionally merging the supplied zone's properties
    save(zone) {
        const previousAnno = this.selectedAnnotation.isSelection ? this.selectedAnnotation.toAnnotation() : this.selectedAnnotation
        const cloneProps = this.modifiedTarget ? { target: this.modifiedTarget } : {}
        if( zone ) {     
            // copy over properties from zone       
            cloneProps.id = zone.id
            cloneProps.body = [
                { type: "TextualBody", value: zone.note }
            ]
        } 
        const nextAnno = previousAnno.clone(cloneProps);
        this.clearSelection();    
        this._annotationLayer.deselect();
        this._annotationLayer.removeAnnotation(previousAnno);
        this._annotationLayer.addAnnotation(nextAnno);
    }

    // Deselect the currently selected zone, undoing any changes to it.
    cancel() {
        this.clearSelection();    
        this._annotationLayer.deselect();
    }
}

function annotationToZone(anno) {
    const note = anno.body[0] ? anno.body[0].value : ""
    const zone = { id: anno.id, note }

    const posStr = anno.target.selector.value
    const polygonPrefix='<svg><polygon points="'

    // can be a polygon or a rectangle
    if( posStr.startsWith(polygonPrefix) ) {
        const polygonSuffix='"></polygon></svg>'
        zone.points = posStr.slice(polygonPrefix.length,-polygonSuffix.length)
    } else {
        const coords = posStr.slice('xywh=pixel:'.length).split(',').map(s => parseFloat(s))
        zone.ulx = coords[0]
        zone.uly = coords[1]
        zone.lrx = coords[2] + coords[0]
        zone.lry = coords[3] + coords[1]
    }
    return zone
}

function zoneToAnnotation(zone) {
    let selector = {}
    if( zone.points ) {
        selector.type = "SvgSelector"
        selector.value =`<svg><polygon points="${zone.points}"></polygon></svg>`
    } else {
        selector.type = "FragmentSelector"
        selector.conformsTo = "http://www.w3.org/TR/media-frags/"
        selector.value =`xywh=pixel:${zone.ulx},${zone.uly},${zone.lrx-zone.ulx},${zone.lry-zone.uly}`
    }

    const anno = { 
        id: zone.id,
        type: "Annotation",
        body: [{
            type: "TextualBody",
            value: zone.note
        }],
        target: {
          selector: selector
        }
      }
    anno["@context"] = "http://www.w3.org/ns/anno.jsonld"
    return anno
}

export default (viewer, config) =>
  new ZoneLayer(viewer, config); 