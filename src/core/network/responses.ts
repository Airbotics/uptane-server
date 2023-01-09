import { Response } from 'express';

const enum EStatusCodes {
    Ok = 200,
    Created = 201,
    Accepted = 202,
    NoContent = 204,
    BadRequest = 400,
    Unauthorized = 401,
    Forbidden = 403,
    NotFound = 404,
    InternalServerError = 500
}

const enum ERespMess {
    InternalServerErrorOccured = 'An unknown internal server error occurred.',
    EndpointNotFound = 'That endpoint cannot be found.',
    MustBeAuthenticated = 'You must be authenticated to do this.',
    MustBeAuthorised = 'You must be authorised to do this.',
}

export class SuccessMessageResponse {
    constructor(res: Response, message: string) {
        return res.status(EStatusCodes.Ok).json({ message });
    }
}

export class AcceptedMessageResponse {
    constructor(res: Response, message: string) {
        return res.status(EStatusCodes.Accepted).json({ message });
    }
}

export class SuccessJsonResponse {
    constructor(res: Response, body: object) {
        return res.status(EStatusCodes.Ok).json(body);
    }
}

export class ValidationResponse {
    constructor(res: Response, errors: string[]) {
        return res.status(EStatusCodes.BadRequest).json({ errors });
    }
}

export class BadResponse {
    constructor(res: Response, error: string) {
        return res.status(EStatusCodes.BadRequest).json({ errors: [error] });
    }
}

export class UnauthorizedResponse {
    constructor(res: Response) {
        return res.status(EStatusCodes.Unauthorized).json({ errors: [ERespMess.MustBeAuthenticated] });
    }
}

export class ForbiddenResponse {
    constructor(res: Response, reason: string) {
        return res.status(EStatusCodes.Forbidden).json({ errors: [reason] });
    }
}

export class NotFoundResponse {
    constructor(res: Response) {
        return res.status(EStatusCodes.NotFound).json({ errors: [ERespMess.EndpointNotFound] });
    }
}

export class InternalServerErrorResponse {
    constructor(res: Response) {
        return res.status(EStatusCodes.InternalServerError).json({ errors: [ERespMess.InternalServerErrorOccured] });
    }
}
