/** Copyright Stewart Allen <sa@grid.space> -- All Rights Reserved */

"use strict";

// dep: add.three
// dep: moto.license
// dep: moto.broker
// dep: mesh.api
// use: mesh.util
gapp.register("mesh.object", [], (root, exports) => {

const { Matrix4, Vector3, Box3, Box3Helper, Quaternion } = THREE;
const { mesh, moto } = root;
const { space } = moto;

const worker = moto.client.fn;
const lookUp = new Vector3(0,0,-1);

// broker updates generated by objects
let publish = {
    meta: gapp.broker.bind("object_meta"),
    destroy: gapp.broker.bind("object_destroy"),
    visible: gapp.broker.bind("object_visible"),
};

mesh.object = class MeshObject {

    constructor(id) {
        this.id = id || mesh.util.uuid();
        worker.object_create({ id: this.id, type: this.type });
        // storage location for meta data like position, scale, rotation
        this.meta = { pos: [0,0,0] };
        this.log('NEW');
    }

    log() {
        mesh.api.log.emit(this.id, this.type, ...arguments);
    }

    get type() {
        throw "type() requires implementation";
    }

    // @returns {THREE.Object3D}
    get object() {
        throw "object() requires implementation";
    }

    get bounds() {
        throw "bounds() requires implementation";
    }

    // manage lifecycle with worker, mesh app caches, etc
    destroy() {
        // update worker state
        worker.object_destroy({id: this.id});
        // update object store
        mesh.db.space.remove(this.id);
        // main app cache workspace updates
        publish.destroy(this.id);
    }

    // used during state restoration
    applyMeta(meta = {}) {
        this.log('apply-meta', meta);
        if (meta.pos) this.position(...meta.pos);
        this.visible(meta.visible ?? true);
        this.metaChanged(meta);
        return this;
    }

    // used during state restoration
    applyMatrix(elements) {
        if (elements) {
            this.log('apply-matrix');
            this.object.applyMatrix4(new Matrix4().fromArray(elements));
        }
        return this;
    }

    // used during model splitting
    applyMatrix4(matrix) {
        return this.applyMatrix(matrix.elements);
    }

    select() {
        throw "select() requires implementation";
    }

    remove() {
        throw "remove() requires implementation";
    }

    focus() {
        mesh.api.focus(this.object);
        return this;
    }

    visible(opt) {
        if (opt === undefined) {
            return this.object.visible;
        }
        if (opt.toggle) {
            this.visible(!this.visible());
        } else {
            this.object.visible = opt;
        }
        publish.visible({ id: this.id, visible: this.object.visible });
        return this;
    }

    floor() {
        let b = this.bounds;
        return this.move(0, 0, -b.min.z);
    }

    center() {
        throw "center() requires implementation";
        let b = this.bounds;
        return this.move(-b.mid.x, -b.mid.y, -b.mid.z);
    }

    centerXY() {
        throw "centerXY() requires implementation";
        let b = this.bounds;
        return this.move(-b.mid.x, -b.mid.y, 0);
    }

    move() {
        throw "move() requires implementation";
    }

    scale() {
        throw "scale() requires implementation";
    }

    qrotate(quaternion) {
        throw "qrotate() requires implementation";
    }

    rotate(x = 0, y = 0, z = 0) {
        this.log('object-rotate', ...arguments);
        let m = new Matrix4();
        if (x) m.multiply(new Matrix4().makeRotationX(x));
        if (y) m.multiply(new Matrix4().makeRotationY(y));
        if (z) m.multiply(new Matrix4().makeRotationZ(z));
        this.qrotate(new Quaternion().setFromRotationMatrix(m));
        return this;
    }

    rotation() {
        throw "rotation() requires implementation";
    }

    // rotate object in the directon of normal (place face on Z plane)
    rotateTowardZ(normal) {
        let q = new Quaternion().setFromUnitVectors(normal, lookUp);
        this.qrotate(q);
        this.floor();
    }

    position() {
        throw "position() requires implementation";
    }

    showBounds(bool) {
        let was = this._showBounds;
        if (bool && bool.toggle) {
            bool = !this._showBounds;
        }
        if (was === bool) {
            return;
        }
        this._showBounds = bool;
        this.updateBoundsBox();
    }

    updateBoundsBox() {
        this.log('update-bounds-box', this._showBounds);
        let helper = this._boundsBox;
        let world = space.world;
        if (helper) {
            world.remove(helper);
        }
        if (this._showBounds) {
            let { mid, dim } = this.bounds;
            let b3 = new Box3().setFromCenterAndSize(
                new Vector3(mid.x, mid.y, mid.z),
                new Vector3(dim.x, dim.y, dim.z)
            );
            let helper = this._boundsBox = new Box3Helper(b3, 0x555555);
            world.add(helper);
            return true;
        }
    }

    metaChanged(values = {}) {
        this.object.updateMatrix();
        this.updateBoundsBox();
        space.update();
        Object.assign(this.meta, values, {
            // matrix: this.object.matrix.elements
        });
        worker.object_meta({ id: this.id, meta: this.meta });
        publish.meta({ id: this.id, meta: this.meta });
        return this;
    }
};

});
