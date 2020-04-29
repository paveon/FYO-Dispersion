Set.prototype.isSuperset = function(subset) {
    for (let elem of subset) {
        if (!this.has(elem)) {
            return false
        }
    }
    return true
};

Set.prototype.union = function(set) {
    let _union = new Set(this)
    for (let elem of set) {
        _union.add(elem)
    }
    return _union
};

Set.prototype.unionM = function(set) {
    for (let elem of set) {
        this.add(elem)
    }
};

Set.prototype.intersection = function(set) {
    let _intersection = new Set()
    for (let elem of set) {
        if (this.has(elem)) {
            _intersection.add(elem)
        }
    }
    return _intersection
}

Set.prototype.symmetricDifference = function(set) {
    let _difference = new Set(this)
    for (let elem of set) {
        if (_difference.has(elem)) {
            _difference.delete(elem)
        } else {
            _difference.add(elem)
        }
    }
    return _difference
}

Set.prototype.difference = function(set) {
    let _difference = new Set(this)
    for (let elem of set) {
        _difference.delete(elem)
    }
    return _difference
}