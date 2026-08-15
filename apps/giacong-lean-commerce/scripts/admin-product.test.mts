import test from "node:test";
import assert from "node:assert/strict";
import { decodeProductVersion, encodeProductVersion, normalizeProductInput } from "../src/lib/admin-product.ts";

test("product input normalizes slug and trims canonical fields",()=>{assert.deepEqual(normalizeProductInput({name:"  Bột  ",slug:"  Bột Ngô  ",sku:" SKU-01 ",shortDescription:" mô tả ",description:" chi tiết ",imageUrl:" /media/products/a.webp ",categoryId:7,isActive:true}),{name:"Bột",slug:"bot-ngo",sku:"SKU-01",shortDescription:"mô tả",description:"chi tiết",imageUrl:"/media/products/a.webp",categoryId:7,isActive:true});});
test("product validation rejects invalid category and fractional ids",()=>{assert.throws(()=>normalizeProductInput({name:"P",slug:"p",sku:"S",shortDescription:"",description:"",imageUrl:null,categoryId:0,isActive:true}),/categoryId/i);assert.throws(()=>normalizeProductInput({name:"P",slug:"p",sku:"S",shortDescription:"",description:"",imageUrl:null,categoryId:1.5,isActive:true}),/categoryId/i);});
test("product version is opaque and round-trips",()=>{const v=encodeProductVersion(17);assert.equal(decodeProductVersion(v),17);assert.notEqual(v,"17");assert.throws(()=>decodeProductVersion("17"),/version/i);});
