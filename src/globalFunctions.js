var FunctionLayer = cc.Layer.extend({
    _delegate: null,

    setDelegate: function (obj) {
        this._delegate = obj;
    }
});