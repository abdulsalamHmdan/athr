const mongoose = require("mongoose");
const schema = fields => new mongoose.Schema(fields, { timestamps: true });
exports.Audit = mongoose.models.AtharAudit || mongoose.model("AtharAudit", schema({ admin: String, ambassador: String, action: String, reference: String, details: mongoose.Schema.Types.Mixed }));
exports.Compatibility = mongoose.models.AtharCompatibility || mongoose.model("AtharCompatibility", schema({ key: { type: String, unique: true }, version: Number, checkedAt: Date }));
