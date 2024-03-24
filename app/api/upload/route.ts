import prisma from "@/lib/prisma";
import { ConversionStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { extname } from "path";
import { v4 as uuid } from 'uuid';
import * as AWS from 'aws-sdk';

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_DEFAULT_REGION
});
  
const bucket = process.env.S3_BUCKET_NAME as string;

export async function POST(req: NextRequest) {
    console.log("Request",req)
    const data = await req.formData()
    const file: File | null = data.get('file') as unknown as File
    const to = data.get('to') as string;
    const from = extname(file.name).replace('.', '');

    if (!file) {
        return new NextResponse(JSON.stringify({ error: "No file found" }), {
            status: 400
        })
    }
    
    if (!to) {
        return new NextResponse(JSON.stringify({ error: "No to found" }), {
            status: 400
        })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // upload file to s3
    const key = `${uuid()}-${file.name}`
    const s3 = new AWS.S3()

    const params = {
        Bucket: bucket,
        Key: key,
        Body: buffer
    }
    const uploadResponse = await s3.upload(params).promise()
    console.log(`File uploaded successfully. ${uploadResponse.Location}`)


    // save the metadata to Postgres
    const conversion = await prisma.conversion.create({
        data: {
            fileLocation: `s3://${bucket}/${key}`,
            from,
            to,
            current: from,
            status: ConversionStatus.PENDING
        }
    })

    // return a UUID 
    return NextResponse.json({ id: conversion.id });
}
