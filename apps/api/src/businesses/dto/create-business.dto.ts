import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateBusinessDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^[A-Z0-9_-]{2,20}$/)
  code!: string;

  @IsIn(['USD', 'KHR', 'BOTH'])
  currency!: 'USD' | 'KHR' | 'BOTH';

  @IsIn([
    'RETAIL', 'GROCERY', 'RESTAURANT_CAFE', 'FASHION', 'ELECTRONICS',
    'BEAUTY_HEALTH', 'PHARMACY', 'SERVICE', 'WHOLESALE', 'OTHER',
  ])
  businessType!:
    | 'RETAIL' | 'GROCERY' | 'RESTAURANT_CAFE' | 'FASHION'
    | 'ELECTRONICS' | 'BEAUTY_HEALTH' | 'PHARMACY'
    | 'SERVICE' | 'WHOLESALE' | 'OTHER';

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  branchName!: string;

  @IsString()
  @Matches(/^[A-Z0-9_-]{2,20}$/)
  branchCode!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  ownerPhone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  ownerFirstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  ownerLastName!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  ownerPassword!: string;
}
