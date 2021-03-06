define([
        "dojo/_base/connect"
], function(connect) {
return function() {
	this.create = function(widget) {
		
	};

	this.destroy = function(widget) {
		if (this.handle) {
			connect.unsubscribe(this.handle);
			delete this.handle;
		}
		widget.dijitWidget.destroyRecursive();
	};

	/*
	 * Called by Outline palette whenever user toggles visibility by clicking on eyeball.
	 * @param {davinci.ve._Widget} widget  Widget whose visibility is being toggled
	 * @param {boolean} on  Whether given widget is currently visible
	 * @return {boolean}  whether standard toggle processing should proceed
	 */
	this.onToggleVisibility = function(widget, on) {
		return false;
	};

	this.onSelect = function(widget) {
		widget.dijitWidget.show();

		var id = widget.dijitWidget.id,
		context = widget.getContext();
		this.handle = connect.subscribe("/davinci/ui/widgetSelected", null, function(selected) {
			for(var w = selected[0]; w && w != widget; w = w.getParent && w.getParent());
			if(!w || w.id != id) {
				context.getDijit().registry.byId(id).hide();
				connect.disconnect(this.handle);
				delete this.handle;
			}
		}.bind(this));
	};
};
});
