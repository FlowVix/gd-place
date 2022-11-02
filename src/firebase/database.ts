import {
    getDatabase,
    ref,
    onChildAdded,
    onChildChanged,
    onChildRemoved,
    onValue,
    get,
    set,
    push,
    child,
    remove,
} from "firebase/database"
import * as PIXI from "pixi.js"
import type * as PIXI_LAYERS from "@pixi/layers"
import { GDObject } from "../editor/object"
import { EditorNode, LEVEL_BOUNDS, ObjectNode } from "../editor/nodes"
import { database, deleteObject, placeObject } from "./init"
import { vec } from "../utils/vector"
import { canEdit } from "./auth"

export const CHUNK_SIZE = vec(20 * 30, 20 * 30)

let canEditValue = false
canEdit.subscribe((value) => {
    canEditValue = value
})

export const initChunkBehavior = (
    editorNode: EditorNode,
    worldNode: PIXI.Container,
    selectableWorldNode: PIXI.Container,
    layerGroup: PIXI_LAYERS.Group,
    selectableLayerGroup: PIXI_LAYERS.Group
) => {
    for (let x = LEVEL_BOUNDS.start.x; x <= LEVEL_BOUNDS.end.x; x += CHUNK_SIZE.x) {
        for (let y = LEVEL_BOUNDS.start.y; y <= LEVEL_BOUNDS.end.y; y += CHUNK_SIZE.y) {
            const chunk = new ChunkNode(x, y, editorNode, selectableWorldNode, layerGroup, selectableLayerGroup)

            worldNode.addChild(chunk)
        }
    }
}

export const addObjectToLevel = (obj: GDObject) => {
    const data = obj.toDatabaseString()
    return placeObject({ text: data })
}

export const deleteObjectFromLevel = (objName: string, chunkName: string) => {
    return deleteObject({ objId: objName, chunkId: chunkName })
}

export class ChunkNode extends PIXI.Container {
    public unload = null;
    public load = null;

    public addObject = null;
    public removeObject = null;

    public lastTimeVisible: number = 0;
    public loaded: boolean = false;

    constructor(
        x: number,
        y: number,
        editorNode: EditorNode,
        selectableWorldNode: PIXI.Container,
        layerGroup: PIXI_LAYERS.Group,
        selectableLayerGroup: PIXI_LAYERS.Group
    ) {
        super()

        let i = x / 20 / 30
        let j = y / 20 / 30
        let chunkName = `${i},${j}`
        this.name = chunkName
        this.visible = false

        // draw box
        const chunkmarker = new PIXI.Graphics()
        chunkmarker.lineStyle(1, 0xbb00bb, 1)
        chunkmarker.drawRect(x, y, CHUNK_SIZE.x, CHUNK_SIZE.y)

        this.addChild(chunkmarker)

        let selectableChunk = new PIXI.Container()
        selectableChunk.name = chunkName
        selectableWorldNode.addChild(selectableChunk)

        this.addObject = (snapshot) => {
            // console.log(snapshot.val());
            let obj = GDObject.fromDatabaseString(snapshot.val())
            let objectNode = new ObjectNode(obj, layerGroup)
            objectNode.name = snapshot.key
            this.addChild(objectNode)

            let selectableSprite = new PIXI.Sprite(PIXI.Texture.EMPTY)
            selectableSprite.name = snapshot.key
            selectableSprite.anchor.set(0.5)
            selectableSprite.alpha = 0.1
            selectableSprite.renderable = false

            selectableSprite.position = objectNode.position
            selectableSprite.rotation = objectNode.rotation
            selectableSprite.width = 40 * objectNode.scale.x
            selectableSprite.height = 40 * objectNode.scale.y
            selectableSprite.parentGroup = selectableLayerGroup

            selectableChunk.addChild(selectableSprite)

            selectableSprite.interactive = true

            selectableSprite.on("pointerup", () => {
                if (canEditValue) {
                    editorNode.deselectObject()
                    objectNode.sprite().tint = 0x00ff00
                    const select_box = new PIXI.Graphics()
                    select_box.name = "select_box"
                    let [width, height] = [objectNode.sprite().width, objectNode.sprite().height]
                    select_box.clear()
                    select_box
                        .lineStyle(1, 0xff3075, 1)
                        .drawRect(-width / 2 - 5, -height / 2 - 5, width + 10, height + 10)

                    console.log(select_box, width, height)

                    objectNode.addChild(select_box)

                    editorNode.selectedObjectNode = objectNode
                    selectableSprite.zOrder = editorNode.nextSelectionZ
                    editorNode.nextSelectionZ -= 1
                    editorNode.selectedObjectChunk = chunkName
                }
            })
        }

        this.removeObject = (snapshot) => {
            if (editorNode.selectedObjectChunk == chunkName && editorNode.selectedObjectNode.name == snapshot.key) {
                editorNode.deselectObject()
            }
            this.getChildByName(snapshot.key).destroy()
            selectableChunk.getChildByName(snapshot.key).destroy()
        }

        this.load = () => {
            const unsub1 = onChildAdded(ref(database, `chunks/${chunkName}`), this.addObject)
            const unsub2 = onChildRemoved(ref(database, `chunks/${chunkName}`), this.removeObject)

            this.loaded = true

            this.unload = () => {
                unsub1()
                unsub2()
                this.loaded = false
            }
        }
    }
}
