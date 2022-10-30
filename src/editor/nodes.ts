import * as PIXI from "pixi.js";
import * as PIXI_LAYERS from "@pixi/layers";

import { vec, Vector } from "../utils/vector";
import type { GDObject } from "./object";
import { deleteObjectFromLevel, initChunkBehavior } from "../firebase/database";
import { clamp, wrap } from "../utils/math";

export const LEVEL_BOUNDS = {
    start: vec(0, 0),
    end: vec(30 * 3000, 30 * 80),
};
const GROUND_SCALE = (30 * 4.25) / 512;

const SPAWN_POS = vec(Math.random() * 30 * 1000, 0);

export class EditorNode extends PIXI.Container {
    public zoomLevel: number = 0;
    public cameraPos: Vector = vec(0, 0);
    public objectPreview: GDObject | null = null;
    public objectPreviewNode: ObjectNode | null = null;
    public layerGroup: PIXI_LAYERS.Group;

    public selectedObjectNode: ObjectNode | null = null;
    public selectedObjectChunk: string | null = null;
    public nextSelectionZ: number = -1;

    public selectableWorld: PIXI.Container;

    public groundTiling: PIXI.TilingSprite;

    removePreview() {
        if (this.objectPreviewNode != null) {
            this.objectPreview = null;
            this.objectPreviewNode.destroy();
            this.objectPreviewNode = null;
        }
    }

    setObjectsSelectable(willYouMakeThemSelectable: boolean) {
        this.selectableWorld.visible = willYouMakeThemSelectable;
    }
    deselectObject() {
        if (this.selectedObjectNode != null) {
            this.selectedObjectNode.getChildByName("select_box").destroy();
            this.selectedObjectNode = null;
            this.selectedObjectChunk = null;
        }
    }
    deleteSelectedObject() {
        if (this.selectedObjectNode != null) {
            let name = this.selectedObjectNode.name;
            let chunk = this.selectedObjectChunk;
            this.deselectObject();
            deleteObjectFromLevel(name, chunk);
        }
    }

    correctObject() {
        if (this.objectPreview != null) {
            this.objectPreview.x = clamp(
                this.objectPreview.x,
                LEVEL_BOUNDS.start.x,
                LEVEL_BOUNDS.end.x
            );
            this.objectPreview.y = clamp(
                this.objectPreview.y,
                LEVEL_BOUNDS.start.y,
                LEVEL_BOUNDS.end.y
            );
            this.objectPreview.rotation = wrap(
                this.objectPreview.rotation,
                0,
                360
            );
            this.objectPreview.scale = clamp(this.objectPreview.scale, 0.5, 2);
            this.objectPreview.zOrder = clamp(
                this.objectPreview.zOrder,
                1,
                100
            );
        }
    }

    updateObjectPreview() {
        this.correctObject();

        if (this.objectPreviewNode != null) {
            this.objectPreviewNode.destroy();
        }
        this.objectPreviewNode = new ObjectNode(
            this.objectPreview,
            this.layerGroup
        );
        const box = new PIXI.Graphics();
        box.name = "box";

        this.objectPreview.x = clamp(
            this.objectPreview.x,
            LEVEL_BOUNDS.start.x,
            LEVEL_BOUNDS.end.x
        );
        this.objectPreview.y = clamp(
            this.objectPreview.y,
            LEVEL_BOUNDS.start.y,
            LEVEL_BOUNDS.end.y
        );

        this.objectPreviewNode.addChild(box);
        this.addChild(this.objectPreviewNode);
    }

    constructor(app: PIXI.Application) {
        super();

        let gridGraph = new PIXI.Graphics();
        this.addChild(gridGraph);

        let obama = new PIXI.Sprite(PIXI.Texture.from("obama.jpg"));
        obama.anchor.set(0.5);
        obama.position.set(LEVEL_BOUNDS.end.x, LEVEL_BOUNDS.end.y);
        obama.scale.set(0.01);
        this.addChild(obama);

        let world = new PIXI.Container();
        this.addChild(world);
        world.sortableChildren = true;

        this.selectableWorld = new PIXI.Container();
        this.addChild(this.selectableWorld);
        this.selectableWorld.sortableChildren = true;

        this.groundTiling = new PIXI.TilingSprite(
            PIXI.Texture.from("gd/world/ground.png"),
            LEVEL_BOUNDS.end.x,
            512 * GROUND_SCALE
        );
        this.groundTiling.tileScale.y = -GROUND_SCALE;
        this.groundTiling.tileScale.x = GROUND_SCALE;
        this.groundTiling.anchor.y = 1;
        this.groundTiling.tint = 0x287dff;

        this.addChild(this.groundTiling);

        this.layerGroup = new PIXI_LAYERS.Group(0, true);
        this.addChild(new PIXI_LAYERS.Layer(this.layerGroup));
        let selectableLayerGroup = new PIXI_LAYERS.Group(0, true);
        this.addChild(new PIXI_LAYERS.Layer(selectableLayerGroup));

        initChunkBehavior(
            this,
            world,
            this.selectableWorld,
            this.layerGroup,
            selectableLayerGroup
        );

        // for (let i = 0; i < 100; i++) {
        //     let sprite = new PIXI.Sprite(
        //         PIXI.Texture.from("gd/objects/main/1.png")
        //     );
        //     sprite.anchor.set(0.5);
        //     sprite.position.x = i;
        //     sprite.visible = false;
        //     cock.addChild(sprite);
        // }

        app.ticker.add(delta => {
            // let last = cock.getChildAt(cock.children.length - 1);
            // cock.removeChildAt(cock.children.length - 1);
            // cock.addChildAt(last, 0);

            this.cameraPos = this.cameraPos.clamped(
                LEVEL_BOUNDS.start,
                LEVEL_BOUNDS.end
            );

            this.position.x = -this.cameraPos.x * this.zoom();
            this.position.y = -this.cameraPos.y * this.zoom();
            this.scale.set(this.zoom());

            gridGraph.clear();
            for (let x = 0; x <= LEVEL_BOUNDS.end.x; x += 30) {
                gridGraph
                    .lineStyle(1.0 / this.zoom(), 0x000000, 0.35)
                    .moveTo(x, LEVEL_BOUNDS.start.y)
                    .lineTo(x, LEVEL_BOUNDS.end.y);
            }
            for (let y = 0; y <= LEVEL_BOUNDS.end.y; y += 30) {
                gridGraph
                    .lineStyle(1.0 / this.zoom(), 0x000000, 0.35)
                    .moveTo(LEVEL_BOUNDS.start.x, y)
                    .lineTo(LEVEL_BOUNDS.end.x, y);
            }

            obama.rotation += 0.01;
            obama.skew.x += 0.001;
            obama.skew.x += 0.005;
            obama.scale.x = Math.cos(obama.rotation) * 0.1;
            obama.scale.y = Math.sin(obama.rotation) * 0.05;

            if (this.objectPreviewNode != null) {
                let box = this.objectPreviewNode.getChildByName(
                    "box"
                ) as PIXI.Graphics;
                let [width, height] = [
                    this.objectPreviewNode.sprite().width,
                    this.objectPreviewNode.sprite().height,
                ];
                box.clear();
                box.lineStyle(
                    1 / this.objectPreviewNode.scale.y,
                    0x00ffff,
                    1
                ).drawRect(
                    -width / 2 - 5,
                    -height / 2 - 5,
                    width + 10,
                    height + 10
                );
            }
        });
    }

    zoom() {
        return 2 ** (this.zoomLevel / 8);
    }

    toWorld(v: Vector, screenSize: Vector) {
        let pos = v.minus(screenSize.div(2)).div(this.zoom());
        pos.y *= -1;
        pos = pos.plus(this.cameraPos);
        return pos;
    }
}

export class ObjectNode extends PIXI.Container {
    constructor(obj: GDObject, layerGroup: PIXI_LAYERS.Group) {
        super();
        let sprite = new PIXI.Sprite(
            PIXI.Texture.from(`gd/objects/main/${obj.id}.png`)
        );

        sprite.anchor.set(0.5);
        sprite.scale.set(0.25, -0.25);
        this.parentGroup = layerGroup;
        this.update(obj);
        this.addChild(sprite);
    }

    update(obj: GDObject) {
        this.scale.set(obj.scale);
        if (obj.flip) {
            this.scale.x *= -1;
        }
        this.rotation = -(obj.rotation * Math.PI) / 180.0;
        this.position.set(obj.x, obj.y);
        this.zOrder = obj.zOrder;
    }

    sprite() {
        return this.getChildAt(0) as PIXI.Sprite;
    }
}

// export class ObjectPreviewNode extends PIXI.Container {
//     constructor(public obj_id: number, layerGroup: PIXI_LAYERS.Group) {
//         super();
//         let sprite = new PIXI.Sprite(
//             PIXI.Texture.from(`gd/objects/main/${obj_id}.png`)
//         );
//         sprite.anchor.set(0.5);

//         sprite.scale.set(0.25, -0.25);
//         // if (obj.flip) {
//         //     this.scale.x *= -1;
//         // }
//         // this.rotation = -(obj.rotation * Math.PI) / 180.0;
//         // this.position.set(obj.x, obj.y);
//         this.addChild(sprite);
//     }

//     sprite() {
//         return this.getChildAt(0) as PIXI.Sprite;
//     }
// }

export class ObjectSelectionRect extends PIXI.Sprite {
    constructor(objNode: ObjectNode) {
        super(PIXI.Texture.WHITE);

        this.alpha = 0.2;
        this.anchor.set(0.5);
        this.interactive = true;
        this.scale.x =
            (objNode.sprite().texture.width * objNode.scale.x) / 16 / 4;
        this.scale.y =
            (objNode.sprite().texture.height * objNode.scale.y) / 16 / 4;
        this.rotation = objNode.rotation;
    }
}