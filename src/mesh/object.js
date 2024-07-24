/** Copyright Stewart Allen <sa@grid.space> -- All Rights Reserved */

"use strict";

// dep: add.three
// dep: moto.license
// dep: moto.broker
// use: mesh.api
// use: mesh.util
gapp.register("mesh.object", [], (root, exports) => {

const { Matrix4, Vector3, Box3, Box3Helper, Quaternion, Euler } = THREE;
const { mesh, moto } = root;
const { space } = moto;

const worker = moto.client.fn;

// broker updates generated by objects
let publish = {
    matrix: gapp.broker.bind("object_matrix"),
    destroy: gapp.broker.bind("object_destroy"),
};

mesh.object = class MeshObject {

    constructor(id) {
        this.id = id || mesh.util.uuid();
        this.deferUBB = () => { this.updateBoundsBox() };
        worker.object_create({id: this.id, type: this.type});
    }

    get type() {
        throw "type() requires implementation";
    }

    // @returns {THREE.Object3D}
    get object() {
        throw "object() requires implementation";
    }

    get bounds() {
        return mesh.util.bounds(this.object);
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

    applyMatrix(elements) {
        if (elements) {
            this.object.applyMatrix4(new Matrix4().fromArray(elements));
        }
        return this.matrixChanged();
    }

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
        return this;
    }

    floor(clazz) {
        if (!clazz || this instanceof clazz) {
            let b = this.bounds;
            this.move(0, 0, -b.min.z);
        }
        return this;
    }

    center(bounds) {
        let b = bounds || this.bounds;
        this.move(-b.mid.x, -b.mid.y, -b.mid.z);
        return this;
    }

    centerXY(bounds) {
        let b = bounds || this.bounds;
        this.move(-b.mid.x, -b.mid.y, 0);
        return this;
    }

    move(x = 0, y = 0, z = 0) {
        let pos = this.position();
        return this.position(pos.x + x, pos.y + y, pos.z + z);
    }

    scale() {
        let scale = this.object.scale;
        if (arguments.length === 0) {
            return scale;
        }
        scale.set(...arguments);
        this.matrixChanged();
    }

    rotate(x = 0, y = 0, z = 0) {
        if (x) this.object.rotateOnWorldAxis(new Vector3(1,0,0), x);
        if (y) this.object.rotateOnWorldAxis(new Vector3(0,1,0), y);
        if (z) this.object.rotateOnWorldAxis(new Vector3(0,0,1), z);
        this.matrixChanged();
        return this;
    }

    rotation() {
        let rotation = this.object.rotation;
        if (arguments.length === 0) {
            return rotation;
        }
        return this.qrotation(new Quaternion().setFromEuler(new Euler(...arguments)));
    }

    qrotation(quaternion) {
        this.object.setRotationFromQuaternion(quaternion);
        this.matrixChanged();
        return this;
    }

    position() {
        let pos = this.object.position;
        if (arguments.length === 0) {
            return pos;
        }
        pos.set(...arguments);
        this.matrixChanged();
        return this;
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

    matrixChanged() {
        if (!this.updateBoundsBox()) {
            this.object.updateMatrix();
        }
        space.update();
        publish.matrix({ id: this.id, matrix: this.object.matrix });
        return this;
    }
};

});
